import { useState } from "react";

function Profile() {
  // Demo state; in a real app, fetch this from backend or context
  const [profile, setProfile] = useState({
    name: "John Doe",
    gender: "male",
    weight: 70, // kg
    height: 175, // cm
    age: 25,
    email: "john@example.com",
  });

  return (
    <div className="max-w-lg mx-auto bg-white rounded-lg shadow p-8 mt-8">
      <h2 className="text-3xl font-bold mb-6 text-purple-700">Profile</h2>
      <div className="space-y-4">
        <div>
          <span className="font-semibold">Name: </span>
          <span>{profile.name}</span>
        </div>
        <div>
          <span className="font-semibold">Email: </span>
          <span>{profile.email}</span>
        </div>
        <div>
          <span className="font-semibold">Gender: </span>
          <span className="capitalize">{profile.gender}</span>
        </div>
        <div>
          <span className="font-semibold">Weight: </span>
          <span>{profile.weight} kg</span>
        </div>
        <div>
          <span className="font-semibold">Height: </span>
          <span>{profile.height} cm</span>
        </div>
        <div>
          <span className="font-semibold">Age: </span>
          <span>{profile.age}</span>
        </div>
      </div>
    </div>
  );
}

export default Profile;