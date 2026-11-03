
import { useEffect, useState } from "react";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [reports, setReports] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);

  const [name, setName] = useState("");
  const [type, setType] = useState("Lost");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [contactNumber, setContactNumber] = useState("");

  const [search, setSearch] = useState("");
  const [activeChat, setActiveChat] = useState(null);
  const [messageText, setMessageText] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setAuthReady(true);
      } else {
        try {
          await signInAnonymously(auth);
        } catch (err) {
          setError(`Sign-in failed: ${err.message}`);
          setAuthReady(true);
        }
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const reportsQuery = query(
      collection(db, "reports"),
      orderBy("createdAt", "desc")
    );

    return onSnapshot(
      reportsQuery,
      (snapshot) =>
        setReports(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        ),
      (err) => setError(`Could not load reports: ${err.message}`)
    );
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const conversationsQuery = query(
      collection(db, "conversations"),
      where("participants", "array-contains", user.uid)
    );

    return onSnapshot(
      conversationsQuery,
      (snapshot) =>
        setConversations(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        ),
      (err) => setError(`Could not load conversations: ${err.message}`)
    );
  }, [user]);

  useEffect(() => {
    if (!activeChat || !user) {
      setMessages([]);
      return;
    }

    const messagesQuery = query(
      collection(db, "conversations", activeChat.id, "messages"),
      orderBy("createdAt", "asc")
    );

    return onSnapshot(
      messagesQuery,
      (snapshot) =>
        setMessages(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        ),
      (err) => setError(`Could not load messages: ${err.message}`)
    );
  }, [activeChat, user]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!user) {
      setError("Please wait for sign-in to finish.");
      return;
    }

    if (!name.trim() || !location.trim() || !description.trim()) {
      setError("Please complete all required fields.");
      return;
    }

    // Contact number is optional, but if supplied it must be valid.
    const digits = contactNumber.replace(/\D/g, "");

    if (contactNumber.trim() && (digits.length < 8 || digits.length > 15)) {
      setError("Enter a valid contact number with country code.");
      return;
    }

    try {
      await addDoc(collection(db, "reports"), {
        name: name.trim(),
        type,
        location: location.trim(),
        description: description.trim(),
        contactNumber: contactNumber.trim(),
        recovered: false,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });

      setName("");
      setType("Lost");
      setLocation("");
      setDescription("");
      setContactNumber("");
      setNotice("Your report was published successfully.");
    } catch (err) {
      setError(`Could not publish report: ${err.message}`);
    }
  }

  async function markRecovered(report) {
    setError("");
    setNotice("");

    try {
      await updateDoc(doc(db, "reports", report.id), {
        recovered: true,
      });
      setNotice("Report marked as resolved.");
    } catch (err) {
      setError(`Could not update report: ${err.message}`);
    }
  }

  async function startChat(report) {
    setError("");
    setNotice("");

    if (!user || !report.userId || report.userId === user.uid) return;

    if (report.recovered) {
      setError("This report has already been resolved.");
      return;
    }

    try {
      const existing = conversations.find(
        (conversation) =>
          conversation.reportId === report.id &&
          conversation.participants?.includes(user.uid) &&
          conversation.participants?.includes(report.userId)
      );

      if (existing) {
        setActiveChat(existing);
        return;
      }

      const conversationRef = await addDoc(
        collection(db, "conversations"),
        {
          participants: [user.uid, report.userId],
          reportId: report.id,
          createdAt: serverTimestamp(),
        }
      );

      setActiveChat({
        id: conversationRef.id,
        participants: [user.uid, report.userId],
        reportId: report.id,
      });
    } catch (err) {
      setError(`Could not start conversation: ${err.message}`);
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    setError("");

    const text = messageText.trim();

    if (!text || !activeChat || !user) return;

    if (text.length > 2000) {
      setError("Messages must be 2000 characters or fewer.");
      return;
    }

    try {
      await addDoc(
        collection(db, "conversations", activeChat.id, "messages"),
        {
          text,
          senderId: user.uid,
          createdAt: serverTimestamp(),
        }
      );

      setMessageText("");
    } catch (err) {
      setError(`Could not send message: ${err.message}`);
    }
  }

  function getReportName(reportId) {
    return reports.find((report) => report.id === reportId)?.name ||
      "Lost-and-found report";
  }

  function getWhatsAppLink(number) {
    const digits = (number || "").replace(/\D/g, "");
    return digits ? `https://wa.me/${digits}` : null;
  }

  function renderReportCard(report) {
    const isOwner = report.userId === user?.uid;
    const whatsappLink = getWhatsAppLink(report.contactNumber);

    return (
      <article className="report-card" key={report.id}>
        <div className="card-topline">
          <span
            className={`type-badge ${
              report.type === "Lost" ? "lost-badge" : "found-badge"
            }`}
          >
            {report.type}
          </span>

          <span
            className={`status-badge ${
              report.recovered ? "resolved-badge" : "active-badge"
            }`}
          >
            {report.recovered ? "Resolved" : "Active"}
          </span>
        </div>

        <h3>{report.name}</h3>
        <p className="report-description">{report.description}</p>

        <div className="report-location">
          <span>⌖</span> {report.location}
        </div>

        {report.contactNumber && (
          <div className="contact-number">
            <span>☎</span>
            <span>{report.contactNumber}</span>
          </div>
        )}

        <div className="card-footer">
          <span className="owner-label">
            {isOwner ? "Your report" : "Community report"}
          </span>

          <div className="card-actions">
            {!isOwner && !report.recovered && (
              <>
                {report.contactNumber && (
                  <a
                    className="contact-button phone-button"
                    href={`tel:${report.contactNumber.replace(/[^\d+]/g, "")}`}
                  >
                    Call
                  </a>
                )}

                {whatsappLink && (
                  <a
                    className="contact-button whatsapp-button"
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    WhatsApp
                  </a>
                )}

                <button
                  className="text-button"
                  type="button"
                  onClick={() => startChat(report)}
                >
                  Message
                </button>
              </>
            )}

            {isOwner && !report.recovered && (
              <button
                className="text-button"
                type="button"
                onClick={() => markRecovered(report)}
              >
                Mark resolved →
              </button>
            )}

            {report.recovered && (
              <span className="muted-text">Case closed</span>
            )}
          </div>
        </div>
      </article>
    );
  }

  const matchingReports = reports.filter((report) =>
    [report.name, report.location, report.description]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const lostReports = matchingReports.filter(
    (report) => report.type === "Lost"
  );

  const foundReports = matchingReports.filter(
    (report) => report.type === "Found"
  );

  if (!authReady) {
    return (
      <main className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading FindIt...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="loading-screen">
        <h2>Unable to sign in</h2>
        <p>{error || "Check your Firebase Authentication settings."}</p>
      </main>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#home">
          <span className="brand-icon">F</span>
          <span>FindIt</span>
        </a>

        <nav>
          <a href="#lost-items">Lost Items</a>
          <a href="#found-items">Found Items</a>
          <a href="#create">Report Item</a>
          <a href="#messages">Messages</a>
        </nav>

        <span className="account-status">
          <span className="status-dot" />
          Connected
        </span>
      </header>

      <main id="home" className="main-content">
        <section className="hero">
          <span className="eyebrow">YOUR COMMUNITY LOST & FOUND</span>
          <h1>
            Lost something?
            <br />
            <span>Let's find it.</span>
          </h1>
          <p>
            Report lost belongings, help reunite people with their items,
            and contact report owners.
          </p>

          <div className="hero-actions">
            <a className="button primary-button" href="#lost-items">
              Browse lost items
            </a>
            <a className="button secondary-button" href="#create">
              + Create report
            </a>
          </div>

          <div className="hero-stats">
            <div>
              <strong>{reports.length}</strong>
              <span>Total reports</span>
            </div>
            <div>
              <strong>{lostReports.length}</strong>
              <span>Lost items</span>
            </div>
            <div>
              <strong>{foundReports.length}</strong>
              <span>Found items</span>
            </div>
          </div>
        </section>

        {error && (
          <div className="alert error-alert" role="alert">
            <span>{error}</span>
            <button onClick={() => setError("")} aria-label="Dismiss error">
              ×
            </button>
          </div>
        )}

        {notice && (
          <div className="alert success-alert" role="status">
            <span>{notice}</span>
            <button onClick={() => setNotice("")} aria-label="Dismiss notice">
              ×
            </button>
          </div>
        )}

        <section id="create" className="section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">HELP YOUR COMMUNITY</span>
              <h2>Report an item</h2>
              <p>Provide details so the owner or finder can be contacted.</p>
            </div>
          </div>

          <form className="report-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <label>
                Item name *
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Black mobile phone"
                  maxLength={100}
                  required
                />
              </label>

              <label>
                Report type *
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="Lost">I lost an item</option>
                  <option value="Found">I found an item</option>
                </select>
              </label>
            </div>

            <label>
              Location *
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. College library"
                maxLength={200}
                required
              />
            </label>

            <label>
              Description *
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the item and where it was lost or found..."
                rows={4}
                maxLength={1000}
                required
              />
            </label>

            <label>
              Phone / WhatsApp number (optional)
              <input
                type="tel"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="e.g. +91 9876543210"
                maxLength={20}
              />
            </label>

            <p className="privacy-warning">
              Privacy notice: a number you provide will be visible to people
              who can view this report. Leave it blank if you prefer to use
              private in-app messaging.
            </p>

            <button className="button primary-button submit-button" type="submit">
              Publish report →
            </button>
          </form>
        </section>

        <section className="section browse-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">FIND AN ITEM</span>
              <h2>Browse reports</h2>
              <p>Search both lost and found reports in one place.</p>
            </div>
          </div>

          <div className="search-box browse-search">
            <span aria-hidden="true">⌕</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search item name, description or location..."
              aria-label="Search reports"
            />
          </div>
        </section>

        <section id="lost-items" className="section item-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">NEEDS TO BE FOUND</span>
              <h2>Lost Items</h2>
              <p>Items reported missing by their owners.</p>
            </div>
            <span className="count-pill">{lostReports.length} reports</span>
          </div>

          {lostReports.length ? (
            <div className="report-grid">
              {lostReports.map(renderReportCard)}
            </div>
          ) : (
            <div className="empty-state">
              <h3>No lost items found</h3>
              <p>Try another search or create a lost-item report.</p>
            </div>
          )}
        </section>

        <section id="found-items" className="section item-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">FOUND BY THE COMMUNITY</span>
              <h2>Found Items</h2>
              <p>Items reported by people who found them.</p>
            </div>
            <span className="count-pill">{foundReports.length} reports</span>
          </div>

          {foundReports.length ? (
            <div className="report-grid">
              {foundReports.map(renderReportCard)}
            </div>
          ) : (
            <div className="empty-state">
              <h3>No found items yet</h3>
              <p>Found something? Publish a report to help its owner.</p>
            </div>
          )}
        </section>

        <section id="messages" className="section chat-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">PRIVATE CONVERSATIONS</span>
              <h2>Your messages</h2>
              <p>Message a report owner without sharing your phone number.</p>
            </div>
          </div>

          <div className="chat-layout">
            <aside className="chat-sidebar">
              <div className="chat-sidebar-heading">
                <h3>Conversations</h3>
                <span>{conversations.length}</span>
              </div>

              {conversations.length === 0 ? (
                <div className="chat-empty">
                  <p>No conversations yet.</p>
                  <small>Select Message on an active report.</small>
                </div>
              ) : (
                <div className="conversation-list">
                  {conversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      className={`conversation-item ${
                        activeChat?.id === conversation.id ? "active" : ""
                      }`}
                      onClick={() => setActiveChat(conversation)}
                    >
                      <span className="conversation-avatar">F</span>
                      <span className="conversation-info">
                        <strong>{getReportName(conversation.reportId)}</strong>
                        <small>Private conversation</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </aside>

            <div className="chat-panel">
              {!activeChat ? (
                <div className="chat-welcome">
                  <div className="chat-welcome-icon">✉</div>
                  <h3>Your private inbox</h3>
                  <p>Select a conversation or start one from a report.</p>
                </div>
              ) : (
                <>
                  <div className="chat-header">
                    <div>
                      <h3>{getReportName(activeChat.reportId)}</h3>
                      <p>Private conversation</p>
                    </div>
                  </div>

                  <div className="message-list" aria-live="polite">
                    {messages.length === 0 ? (
                      <div className="message-empty">
                        No messages yet. Start the conversation.
                      </div>
                    ) : (
                      messages.map((message) => (
                        <div
                          key={message.id}
                          className={`message-row ${
                            message.senderId === user.uid ? "my-message" : ""
                          }`}
                        >
                          <div
                            className={`message-bubble ${
                              message.senderId === user.uid
                                ? "mine"
                                : "theirs"
                            }`}
                          >
                            <p>{message.text}</p>
                            <small>
                              {message.senderId === user.uid ? "You" : "Other user"}
                            </small>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <form className="message-form" onSubmit={sendMessage}>
                    <input
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Write a private message..."
                      maxLength={2000}
                      required
                    />
                    <button className="button primary-button send-button" type="submit">
                      Send ↑
                    </button>
                  </form>
                  <p className="chat-privacy-note">
                    Only the conversation participants should be able to read
                    these messages.
                  </p>
                </>
              )}
            </div>
          </div>
        </section>

        <footer className="footer">
          <a className="brand footer-brand" href="#home">
            <span className="brand-icon">F</span>
            <span>FindIt</span>
          </a>
          <p>Helping lost things find their way home.</p>
          <a href="#home">Back to top ↑</a>
        </footer>
      </main>
    </div>
  );
}

export default App;
