import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Signup() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("http://localhost:5000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setLoading(false);

    if (res.ok) {
      alert("Signup successful! Please log in.");
      navigate("/login");
    } else {
      const data = await res.json();
      alert(data.msg || "Signup failed");
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6">Signup</h2>
        <input
          name="name"
          placeholder="Name"
          className="w-full p-2 border mb-4"
          onChange={handleChange}
          value={form.name}
          required
        />
        <input
          name="email"
          placeholder="Email"
          type="email"
          className="w-full p-2 border mb-4"
          onChange={handleChange}
          value={form.email}
          required
        />
        <input
          name="password"
          placeholder="Password"
          type="password"
          className="w-full p-2 border mb-4"
          onChange={handleChange}
          value={form.password}
          minLength={6}
          required
        />
        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 rounded"
          disabled={loading}
        >
          {loading ? "Signing up..." : "Signup"}
        </button>
      </form>
    </div>
  );
}

export default Signup;
