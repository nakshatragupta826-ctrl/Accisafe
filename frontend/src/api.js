import { auth } from "./firebase";

export async function apiFetch(url, options = {}) {
    const currentUser = auth.currentUser;

    if (!currentUser) {
        throw new Error("User is not authenticated.");
    }

    // First attempt: Firebase normally refreshes the ID token automatically.
    let token = await currentUser.getIdToken();

    let headers = {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
    };

    let response = await fetch(url, {
        ...options,
        headers,
    });

    // If backend rejects the token, force Firebase to get a fresh one
    // and retry the request once.
    if (response.status === 401) {
        console.log("Firebase token expired. Refreshing token...");

        token = await currentUser.getIdToken(true);

        headers = {
            ...(options.headers || {}),
            Authorization: `Bearer ${token}`,
        };

        response = await fetch(url, {
            ...options,
            headers,
        });
    }

    return response;
}