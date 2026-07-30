import { useState } from "react";

// BMR formulas
const BMR_FORMULAS = [
	{
		name: "Mifflin-St Jeor",
		calc: (gender, weight, height, age) =>
			gender === "male"
				? 10 * weight + 6.25 * height - 5 * age + 5
				: 10 * weight + 6.25 * height - 5 * age - 161,
		desc: "Most modern and widely used formula.",
	},
	{
		name: "Harris-Benedict",
		calc: (gender, weight, height, age) =>
			gender === "male"
				? 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age
				: 447.593 + 9.247 * weight + 3.098 * height - 4.330 * age,
		desc: "Classic formula, slightly overestimates for modern lifestyles.",
	},
	{
		name: "Katch-McArdle",
		calc: (gender, weight, height, age, bodyFat) =>
			370 + 21.6 * (weight * (1 - (bodyFat || 0) / 100)),
		desc: "Requires body fat %, best for athletes.",
		needsBodyFat: true,
	},
];

const ACTIVITY_LEVELS = [
	{ label: "Sedentary (little or no exercise)", value: 1.2 },
	{ label: "Lightly active (light exercise/sports 1-3 days/week)", value: 1.375 },
	{ label: "Moderately active (moderate exercise/sports 3-5 days/week)", value: 1.55 },
	{ label: "Very active (hard exercise/sports 6-7 days/week)", value: 1.725 },
	{ label: "Extra active (very hard exercise & physical job)", value: 1.9 },
];

// Conversion helpers
const lbToKg = (lb) => lb * 0.453592;
const kgToLb = (kg) => kg / 0.453592;
const ftInToCm = (ft, inch) => ft * 30.48 + inch * 2.54;
const cmToFtIn = (cm) => {
	const totalInches = cm / 2.54;
	const ft = Math.floor(totalInches / 12);
	const inch = Math.round(totalInches % 12);
	return { ft, inch };
};

const daysOfWeek = [
	"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
];

function Fitness() {
	const [gender, setGender] = useState("male");
	const [unit, setUnit] = useState("metric"); // "metric" or "imperial"

	// Metric state
	const [weight, setWeight] = useState(""); // kg
	const [height, setHeight] = useState(""); // cm

	// Imperial state
	const [weightLb, setWeightLb] = useState(""); // lb
	const [heightFt, setHeightFt] = useState(""); // ft
	const [heightIn, setHeightIn] = useState(""); // in

	const [age, setAge] = useState(""); // years
	const [bodyFat, setBodyFat] = useState(""); // %
	const [bmrFormula, setBmrFormula] = useState(BMR_FORMULAS[0].name);
	const [activity, setActivity] = useState(ACTIVITY_LEVELS[0].value);

	// Fitness plans state
	const [fitnessPlans, setFitnessPlans] = useState({
		Sunday: [],
		Monday: [],
		Tuesday: [],
		Wednesday: [],
		Thursday: [],
		Friday: [],
		Saturday: [],
	});
	const [selectedFitnessDay, setSelectedFitnessDay] = useState(daysOfWeek[0]);
	const [fitnessForm, setFitnessForm] = useState({ name: "", desc: "" });
	const [editIdx, setEditIdx] = useState(null);

	// Handle unit switch and convert values
	const handleUnitChange = (e) => {
		const newUnit = e.target.value;
		if (newUnit === unit) return;
		if (newUnit === "imperial") {
			// Convert metric to imperial
			setWeightLb(weight ? Math.round(kgToLb(Number(weight))) : "");
			const { ft, inch } = height ? cmToFtIn(Number(height)) : { ft: "", inch: "" };
			setHeightFt(ft || "");
			setHeightIn(inch || "");
		} else {
			// Convert imperial to metric
			setWeight(weightLb ? Math.round(lbToKg(Number(weightLb))) : "");
			setHeight(
				heightFt || heightIn
					? Math.round(ftInToCm(Number(heightFt) || 0, Number(heightIn) || 0))
					: ""
			);
		}
		setUnit(newUnit);
	};

	// Get metric values for calculation
	const calcWeight = unit === "metric"
		? Number(weight)
		: weightLb
		? lbToKg(Number(weightLb))
		: "";
	const calcHeight = unit === "metric"
		? Number(height)
		: heightFt || heightIn
		? ftInToCm(Number(heightFt) || 0, Number(heightIn) || 0)
		: "";

	// BMI calculation
	const bmi =
		calcWeight && calcHeight
			? (calcWeight / ((calcHeight / 100) * (calcHeight / 100))).toFixed(2)
			: "";

	// Find selected BMR formula
	const selectedFormula = BMR_FORMULAS.find((f) => f.name === bmrFormula);

	// BMR calculation
	let bmr = "";
	if (calcWeight && calcHeight && age) {
		if (selectedFormula.needsBodyFat && bodyFat) {
			bmr = selectedFormula.calc(
				gender,
				calcWeight,
				calcHeight,
				Number(age),
				Number(bodyFat)
			);
		} else if (!selectedFormula.needsBodyFat) {
			bmr = selectedFormula.calc(gender, calcWeight, calcHeight, Number(age));
		}
		bmr = bmr ? bmr.toFixed(0) : "";
	}

	// Daily calorie needs
	const dailyCalories = bmr ? Math.round(bmr * activity) : "";

	// Add workout
	const handleAddFitness = (e) => {
		e.preventDefault();
		if (!fitnessForm.name) return;
		setFitnessPlans((prev) => ({
			...prev,
			[selectedFitnessDay]: [
				...prev[selectedFitnessDay],
				{ name: fitnessForm.name, desc: fitnessForm.desc }
			]
		}));
		setFitnessForm({ name: "", desc: "" });
		setEditIdx(null);
	};

	// Edit workout
	const handleEditFitness = (idx) => {
		const workout = fitnessPlans[selectedFitnessDay][idx];
		setFitnessForm({ name: workout.name, desc: workout.desc });
		setEditIdx(idx);
	};

	// Save edited workout
	const handleSaveEditFitness = (e) => {
		e.preventDefault();
		setFitnessPlans((prev) => ({
			...prev,
			[selectedFitnessDay]: prev[selectedFitnessDay].map((w, idx) =>
				idx === editIdx ? { name: fitnessForm.name, desc: fitnessForm.desc } : w
			),
		}));
		setFitnessForm({ name: "", desc: "" });
		setEditIdx(null);
	};

	// Delete workout
	const handleDeleteFitness = (idx) => {
		setFitnessPlans((prev) => ({
			...prev,
			[selectedFitnessDay]: prev[selectedFitnessDay].filter((_, i) => i !== idx),
		}));
		setEditIdx(null);
	};

	return (
		<div className="flex flex-col md:flex-row gap-8 p-8 min-h-screen bg-gray-50">
			{/* Left: Profile & Calculations */}
			<div className="flex-1 max-w-xl mx-auto md:mx-0 bg-white rounded-lg shadow p-8">
				<h2 className="text-3xl font-bold mb-6 text-blue-700">Fitness Profile</h2>
				<form className="space-y-4">
					<div>
						<label className="block font-semibold mb-1">Gender</label>
						<select
							className="w-full border rounded p-2"
							value={gender}
							onChange={(e) => setGender(e.target.value)}
						>
							<option value="male">Male</option>
							<option value="female">Female</option>
						</select>
					</div>
					<div>
						<label className="block font-semibold mb-1">Units</label>
						<select
							className="w-full border rounded p-2"
							value={unit}
							onChange={handleUnitChange}
						>
							<option value="metric">Metric (kg, cm)</option>
							<option value="imperial">Imperial (lb, ft/in)</option>
						</select>
					</div>
					{unit === "metric" ? (
						<div className="flex gap-4">
							<div className="flex-1">
								<label className="block font-semibold mb-1">Weight (kg)</label>
								<input
									type="number"
									min="1"
									className="w-full border rounded p-2"
									value={weight}
									onChange={(e) => setWeight(e.target.value)}
								/>
							</div>
							<div className="flex-1">
								<label className="block font-semibold mb-1">Height (cm)</label>
								<input
									type="number"
									min="1"
									className="w-full border rounded p-2"
									value={height}
									onChange={(e) => setHeight(e.target.value)}
								/>
							</div>
						</div>
					) : (
						<div className="flex gap-4">
							<div className="flex-1">
								<label className="block font-semibold mb-1">Weight (lb)</label>
								<input
									type="number"
									min="1"
									className="w-full border rounded p-2"
									value={weightLb}
									onChange={(e) => setWeightLb(e.target.value)}
								/>
							</div>
							<div className="flex-1 flex gap-2">
								<div>
									<label className="block font-semibold mb-1">Height (ft)</label>
									<input
										type="number"
										min="0"
										className="w-full border rounded p-2"
										value={heightFt}
										onChange={(e) => setHeightFt(e.target.value)}
									/>
								</div>
								<div>
									<label className="block font-semibold mb-1">Height (in)</label>
									<input
										type="number"
										min="0"
										max="11"
										className="w-full border rounded p-2"
										value={heightIn}
										onChange={(e) => setHeightIn(e.target.value)}
									/>
								</div>
							</div>
						</div>
					)}
					<div>
						<label className="block font-semibold mb-1">Age (years)</label>
						<input
							type="number"
							min="1"
							className="w-full border rounded p-2"
							value={age}
							onChange={(e) => setAge(e.target.value)}
						/>
					</div>
					<div>
						<label className="block font-semibold mb-1">BMR Formula</label>
						<select
							className="w-full border rounded p-2"
							value={bmrFormula}
							onChange={(e) => setBmrFormula(e.target.value)}
						>
							{BMR_FORMULAS.map((f) => (
								<option key={f.name} value={f.name}>
									{f.name}
								</option>
							))}
						</select>
						<div className="text-xs text-gray-500 mt-1">
							{selectedFormula.desc}
						</div>
					</div>
					{selectedFormula.needsBodyFat && (
						<div>
							<label className="block font-semibold mb-1">Body Fat (%)</label>
							<input
								type="number"
								min="1"
								max="100"
								className="w-full border rounded p-2"
								value={bodyFat}
								onChange={(e) => setBodyFat(e.target.value)}
							/>
						</div>
					)}
					<div>
						<label className="block font-semibold mb-1">Activity Level</label>
						<select
							className="w-full border rounded p-2"
							value={activity}
							onChange={(e) => setActivity(Number(e.target.value))}
						>
							{ACTIVITY_LEVELS.map((a) => (
								<option key={a.value} value={a.value}>
									{a.label}
								</option>
							))}
						</select>
					</div>
				</form>

				<div className="mt-8 space-y-4">
					<div>
						<span className="font-semibold">BMI: </span>
						<span className="text-blue-700 text-lg">{bmi || "--"}</span>
						{bmi && (
							<span className="ml-2 text-sm text-gray-500">
								{bmi < 18.5
									? "Underweight"
									: bmi < 25
									? "Normal"
									: bmi < 30
									? "Overweight"
									: "Obese"}
							</span>
						)}
					</div>
					<div>
						<span className="font-semibold">BMR: </span>
						<span className="text-blue-700 text-lg">{bmr || "--"} kcal/day</span>
					</div>
					<div>
						<span className="font-semibold">Daily Calorie Needs: </span>
						<span className="text-green-700 text-lg">
							{dailyCalories || "--"} kcal/day
						</span>
					</div>
				</div>
			</div>

			{/* Right: 7 Days Fitness Workout Routine */}
			<div className="flex-1 max-w-xl mx-auto md:mx-0 bg-white rounded-lg shadow p-8">
				<h2 className="text-2xl font-bold mb-4 text-green-700 text-center">7 Days Fitness Workout Routine</h2>
				{/* Day Selector */}
				<div className="flex flex-wrap gap-2 justify-center mb-4">
					{daysOfWeek.map((day) => (
						<button
							key={day}
							className={`px-3 py-1 rounded-full font-semibold transition ${
								selectedFitnessDay === day
									? "bg-green-600 text-white shadow"
									: "bg-gray-200 text-gray-700 hover:bg-green-100"
							}`}
							onClick={() => {
								setSelectedFitnessDay(day);
								setFitnessForm({ name: "", desc: "" });
								setEditIdx(null);
							}}
						>
							{day}
						</button>
					))}
				</div>
				{/* Add/Edit Workout Form */}
				<form
					onSubmit={editIdx !== null ? handleSaveEditFitness : handleAddFitness}
					className="flex flex-col md:flex-row gap-2 items-end mb-4"
				>
					<input
						type="text"
						placeholder="Workout Name"
						className="p-2 border rounded flex-1"
						value={fitnessForm.name}
						onChange={(e) =>
							setFitnessForm((f) => ({ ...f, name: e.target.value }))
						}
						required
					/>
					<input
						type="text"
						placeholder="Description (optional)"
						className="p-2 border rounded flex-1"
						value={fitnessForm.desc}
						onChange={(e) =>
							setFitnessForm((f) => ({ ...f, desc: e.target.value }))
						}
					/>
					<button
						type="submit"
						className="bg-green-500 text-white px-4 py-2 rounded"
					>
						{editIdx !== null ? "Save" : "Add"}
					</button>
					{editIdx !== null && (
						<button
							type="button"
							className="bg-gray-300 px-4 py-2 rounded"
							onClick={() => {
								setFitnessForm({ name: "", desc: "" });
								setEditIdx(null);
							}}
						>
							Cancel
						</button>
					)}
				</form>
				{/* Workout List */}
				<div className="bg-gray-50 rounded p-4 min-h-[180px]">
					{fitnessPlans[selectedFitnessDay].length === 0 ? (
						<p className="text-gray-500 text-center">No workouts for {selectedFitnessDay}.</p>
					) : (
						<ul>
							{fitnessPlans[selectedFitnessDay].map((w, idx) => (
								<li
									key={idx}
									className="flex justify-between items-center border-b py-2"
								>
									<div>
										<span className="font-semibold">{w.name}</span>
										{w.desc && (
											<span className="text-gray-600 text-sm ml-2">
												({w.desc})
											</span>
										)}
									</div>
									<div className="flex gap-2">
										<button
											className="text-blue-600 hover:underline text-sm"
											onClick={() => handleEditFitness(idx)}
										>
											Edit
										</button>
										<button
											className="text-red-600 hover:underline text-sm"
											onClick={() => handleDeleteFitness(idx)}
										>
											Delete
										</button>
									</div>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>
		</div>
	);
}

export default Fitness;