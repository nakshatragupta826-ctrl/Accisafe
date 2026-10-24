import { useState } from "react";
import { loginUser, registerUser } from "./authService";
import "./AuthPage.css";

function AuthPage({ onLogin }) {

    const [isRegister, setIsRegister] = useState(false);

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(e) {

        e.preventDefault();

        setError("");
        setLoading(true);

        try {

            let user;

            if (isRegister) {

                user = await registerUser(
                    email,
                    password
                );

            } else {

                user = await loginUser(
                    email,
                    password
                );
            }

            onLogin(user);

        } catch (err) {

            console.error(err);

            if (err.code === "auth/email-already-in-use") {
                setError("This email is already registered.");
            }
            else if (err.code === "auth/invalid-email") {
                setError("Please enter a valid email address.");
            }
            else if (err.code === "auth/weak-password") {
                setError("Password must be at least 6 characters.");
            }
            else if (
                err.code === "auth/invalid-credential" ||
                err.code === "auth/wrong-password"
            ) {
                setError("Invalid email or password.");
            }
            else if (err.code === "auth/user-not-found") {
                setError("No account exists with this email.");
            }
            else {
                setError(err.message);
            }

        } finally {

            setLoading(false);

        }
    }

    return (
        <div className="auth-page">

            <div className="auth-card">

                <div className="auth-logo">
                    🛡️
                </div>

                <h1>AcciSafe</h1>

                <p>
                    {isRegister
                        ? "Create your rider account"
                        : "Rider Safety System"}
                </p>

                <form onSubmit={handleSubmit}>

                    <label>Email</label>

                    <input
                        type="email"
                        value={email}
                        onChange={(e) =>
                            setEmail(e.target.value)
                        }
                        placeholder="Enter your email"
                        required
                    />

                    <label>Password</label>

                    <input
                        type="password"
                        value={password}
                        onChange={(e) =>
                            setPassword(e.target.value)
                        }
                        placeholder="Enter your password"
                        required
                    />

                    {error && (
                        <div className="auth-error">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                    >
                        {loading
                            ? "Please wait..."
                            : isRegister
                                ? "Create Account"
                                : "Sign In"}
                    </button>

                </form>

                <div className="auth-switch">

                    {isRegister
                        ? "Already have an account?"
                        : "Don't have an account?"}

                    <button
                        type="button"
                        onClick={() => {
                            setIsRegister(!isRegister);
                            setError("");
                        }}
                    >
                        {isRegister
                            ? "Sign In"
                            : "Create Account"}
                    </button>

                </div>

            </div>

        </div>
    );
}

export default AuthPage;