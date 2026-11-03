# Findit

Findit is a React app built with Vite and Firebase.

## Run locally

```sh
npm ci
npm run dev
```

## Deploy to GitHub Pages

1. Create a GitHub repository and push the contents of this `findit` folder to its `main` branch.
2. In the repository, open **Settings → Pages** and set the build and deployment source to **GitHub Actions**.
3. Each push to `main` will build and deploy the app. You can also run the workflow manually from the **Actions** tab.

The Vite build uses relative asset paths, so it works both on a repository Pages URL and on a custom domain.

## Firebase

The app uses the Firebase project configured in `src/firebase.js`. Enable **Anonymous** sign-in in Firebase Authentication and configure Firestore rules for the app before using the deployed site. The Firebase web config is included in the client bundle; protect data with Firebase security rules rather than relying on the config being secret.
