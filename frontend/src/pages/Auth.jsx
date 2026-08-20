import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config/api";

function Auth() {
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState({ name: "", email: "", password: "" });
  const [loginLoading, setLoginLoading] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const navigate = useNavigate();

  const handleLoginChange = (e) => {
    setLoginForm({ ...loginForm, [e.target.name]: e.target.value });
  };

  const handleSignupChange = (e) => {
    setSignupForm({ ...signupForm, [e.target.name]: e.target.value });
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginLoading(true);

    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginForm),
    });

    setLoginLoading(false);

    const data = await res.json();
    if (res.ok) {
      localStorage.setItem("token", data.token);
      localStorage.setItem(
        "user",
        JSON.stringify({
          name: data.user?.name || "User",
          email: data.user?.email || loginForm.email,
        })
      );
      navigate("/dashboard");
    } else {
      alert(data.msg || "Login failed");
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setSignupLoading(true);

    const res = await fetch(`${API_BASE}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signupForm),
    });

    setSignupLoading(false);

    const data = await res.json();
    if (res.ok) {
      alert("Signup successful! Please log in using the login form.");
      setLoginForm({ email: signupForm.email, password: "" });
      setSignupForm({ name: "", email: "", password: "" });
    } else {
      alert(data.msg || "Signup failed");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-6xl bg-white rounded-3xl shadow-xl overflow-hidden">
        <div className="bg-gray-900 p-6 text-center">
          <img src="/thikana-brand.svg" alt="ThikanaBD Logo" className="mx-auto h-20 w-auto mb-4" />
          <h1 className="text-3xl font-bold text-white">Welcome to ThikanaBD</h1>
          <p className="text-gray-300 mt-2">Choose one of the options below to sign up or log in.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-8">
          <div className="border border-gray-200 rounded-3xl p-8 bg-gradient-to-br from-white via-slate-50 to-slate-100">
            <h2 className="text-2xl font-semibold mb-4">LOG IN</h2>
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <input
                name="email"
                type="email"
                placeholder="Email"
                value={loginForm.email}
                onChange={handleLoginChange}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-green-500 focus:outline-none"
                required
              />
              <input
                name="password"
                type="password"
                placeholder="Password"
                value={loginForm.password}
                onChange={handleLoginChange}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-green-500 focus:outline-none"
                required
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-green-600 text-white py-3 font-semibold hover:bg-green-700 disabled:opacity-70"
                disabled={loginLoading}
              >
                {loginLoading ? "Logging in..." : "Login"}
              </button>
            </form>
          </div>

          <div className="border border-gray-200 rounded-3xl p-8 bg-gradient-to-br from-white via-slate-50 to-slate-100">
            <h2 className="text-2xl font-semibold mb-4">SIGN UP</h2>
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              <input
                name="name"
                type="text"
                placeholder="Name"
                value={signupForm.name}
                onChange={handleSignupChange}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none"
                required
              />
              <input
                name="email"
                type="email"
                placeholder="Email"
                value={signupForm.email}
                onChange={handleSignupChange}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none"
                required
              />
              <input
                name="password"
                type="password"
                placeholder="Password"
                value={signupForm.password}
                onChange={handleSignupChange}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none"
                minLength={6}
                required
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-blue-600 text-white py-3 font-semibold hover:bg-blue-700 disabled:opacity-70"
                disabled={signupLoading}
              >
                {signupLoading ? "Signing up..." : "Signup"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Auth;
