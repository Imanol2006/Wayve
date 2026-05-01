import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  Search,
  Settings,
  ArrowLeft,
  CheckCircle,
  StopCircle,
  Volume2,
  ArrowRight,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function maneuverToDirection(maneuver) {
  if (!maneuver) return "straight";
  if (maneuver.includes("left")) return "left";
  if (maneuver.includes("right")) return "right";
  return "straight";
}

function stripHtml(html) {
  return html?.replace(/<[^>]*>/g, "") ?? "";
}

function loadGoogleMapsScript(key) {
  return new Promise((resolve) => {
    if (window.google?.maps) { resolve(); return; }
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}`;
    s.onload = resolve;
    document.head.appendChild(s);
  });
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function ConnectionPill({ connected }) {
  return (
    <span
      className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold select-none"
      style={{
        background: connected ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.12)",
        border: `1px solid ${connected ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.3)"}`,
        color: connected ? "#10B981" : "#EF4444",
        transition: "all 200ms ease",
      }}
    >
      {connected ? "🟢" : "🔴"}&nbsp;{connected ? "Connected" : "Disconnected"}
    </span>
  );
}

function TopBar({ onBack, caneConnected, setCaneConnected }) {
  return (
    <div
      className="flex items-center justify-between px-5 py-4 shrink-0"
      style={{ borderBottom: "1px solid #1F2937" }}
    >
      <button
        onClick={onBack}
        aria-label="Go back"
        className="cane-btn flex items-center justify-center rounded-full"
        style={{
          width: 38,
          height: 38,
          background: "#111827",
          border: "1px solid #1F2937",
        }}
      >
        <ArrowLeft size={17} color="#F9FAFB" />
      </button>

      <span
        className="font-black tracking-widest text-sm select-none"
        style={{ color: "#F9FAFB", letterSpacing: "0.2em" }}
      >
        WAYVE
      </span>

      <button
        onClick={() => setCaneConnected((v) => !v)}
        aria-label={`Cane ${caneConnected ? "connected" : "disconnected"} — tap to toggle`}
        className="cane-btn"
      >
        <ConnectionPill connected={caneConnected} />
      </button>
    </div>
  );
}

function Toggle({ value, onChange, ariaLabel }) {
  return (
    <button
      role="switch"
      aria-checked={value}
      aria-label={ariaLabel}
      onClick={() => onChange(!value)}
      className="cane-btn relative inline-flex shrink-0 items-center rounded-full"
      style={{
        width: 44,
        height: 24,
        background: value ? "#3B82F6" : "#374151",
        transition: "background 200ms ease",
      }}
    >
      <span
        className="inline-block rounded-full bg-white shadow"
        style={{
          width: 18,
          height: 18,
          transform: value ? "translateX(22px)" : "translateX(3px)",
          transition: "transform 200ms ease",
        }}
      />
    </button>
  );
}

function PillSelector({ options, value, onChange }) {
  return (
    <div className="flex gap-1 shrink-0">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          aria-label={`Select ${opt}`}
          className="cane-btn px-2.5 py-1 rounded-lg text-xs font-semibold"
          style={{
            background: value === opt ? "#3B82F6" : "#1A2235",
            color: value === opt ? "#fff" : "#6B7280",
            border: `1px solid ${value === opt ? "rgba(59,130,246,0.6)" : "#1F2937"}`,
            transition: "all 150ms ease",
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function SectionDivider({ label }) {
  return (
    <p
      className="px-5 pt-7 pb-2 text-xs font-bold uppercase tracking-widest"
      style={{ color: "#374151" }}
    >
      {label}
    </p>
  );
}

function SettingRow({ label, description, control, large }) {
  return (
    <div
      className="flex items-center justify-between px-5 py-4"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
    >
      <div className="flex flex-col gap-0.5 flex-1 pr-4 min-w-0">
        <p className="font-medium" style={{ color: "#F9FAFB", fontSize: large ? 17 : 15 }}>
          {label}
        </p>
        {description && (
          <p style={{ color: "#6B7280", fontSize: 12, lineHeight: 1.5 }}>{description}</p>
        )}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

// ─── Directional arrow SVG ────────────────────────────────────────────────────
function DirectionalArrow({ direction }) {
  const rotation = direction === "left" ? -90 : direction === "right" ? 90 : 0;
  return (
    <div
      style={{
        transform: `rotate(${rotation}deg)`,
        transition: "transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        filter: "drop-shadow(0 0 24px rgba(59,130,246,0.55))",
      }}
    >
      <svg
        width={90}
        height={108}
        viewBox="0 0 90 108"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M45 4 L86 54 H61 V104 H29 V54 H4 Z"
          fill="#3B82F6"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

// ─── Screen transition preset ─────────────────────────────────────────────────
const fade = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.28, ease: "easeOut" },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 1 — HOME
// ═══════════════════════════════════════════════════════════════════════════════
function HomeScreen({
  navigate,
  isListening,
  handleMicPress,
  destinationInput,
  setDestinationInput,
  handleSearch,
  handleQuickDestination,
  large,
}) {
  const quickDests = [
    { emoji: "🏠", label: "Home" },
    { emoji: "🏥", label: "Nearest Hospital" },
    { emoji: "🚌", label: "Nearest Bus Stop" },
  ];

  return (
    <motion.div
      key="home"
      {...fade}
      className="flex flex-col min-h-screen px-6 pb-10"
      style={{ background: "#0A0E1A" }}
    >
      {/* ── Identity ── */}
      <div className="flex flex-col items-center text-center mt-[72px] mb-10">
        <h1
          className="font-black"
          style={{
            color: "#F9FAFB",
            fontSize: 58,
            lineHeight: 1.0,
            letterSpacing: "-0.04em",
          }}
        >
          Wayve
        </h1>
        <p
          className="mt-3 font-normal"
          style={{ color: "#9CA3AF", fontSize: 16, letterSpacing: "0.01em" }}
        >
          Navigate the world. Feel every turn.
        </p>
      </div>

      {/* ── Mic button ── */}
      <div className="flex flex-col items-center gap-3 mb-9">
        <div className="relative flex items-center justify-center">
          {isListening && (
            <>
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: -14,
                  borderRadius: "50%",
                  border: "2px solid #7C3AED",
                  animation: "cane-pulse-outer 1.5s ease-out infinite",
                }}
              />
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: -5,
                  borderRadius: "50%",
                  border: "2px solid rgba(124,58,237,0.65)",
                  animation: "cane-pulse-inner 1.5s ease-out 0.3s infinite",
                }}
              />
            </>
          )}
          <button
            onClick={handleMicPress}
            aria-label={isListening ? "Stop listening" : "Speak your destination"}
            className="cane-btn relative flex items-center justify-center rounded-full"
            style={{
              width: 88,
              height: 88,
              background: isListening ? "#7C3AED" : "#3B82F6",
              boxShadow: isListening
                ? "0 0 52px rgba(124,58,237,0.5), 0 8px 32px rgba(0,0,0,0.55)"
                : "0 0 40px rgba(59,130,246,0.32), 0 8px 32px rgba(0,0,0,0.45)",
              transition: "background 240ms ease, box-shadow 240ms ease",
            }}
          >
            <Mic size={34} color="white" />
          </button>
        </div>
        <p
          className="font-medium"
          style={{
            color: "#9CA3AF",
            fontSize: large ? 18 : 15,
            minHeight: 24,
            transition: "opacity 200ms ease",
          }}
        >
          {isListening ? "Listening…" : "Speak your destination"}
        </p>
      </div>

      {/* ── Divider ── */}
      <div className="flex items-center gap-3 mb-7">
        <div className="flex-1 h-px" style={{ background: "#1F2937" }} />
        <span
          className="text-xs font-semibold"
          style={{ color: "#374151", letterSpacing: "0.12em" }}
        >
          or
        </span>
        <div className="flex-1 h-px" style={{ background: "#1F2937" }} />
      </div>

      {/* ── Text input ── */}
      <div className="flex flex-col gap-3 mb-8">
        <input
          type="text"
          value={destinationInput}
          onChange={(e) => setDestinationInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Type a destination…"
          aria-label="Type a destination"
          className="w-full rounded-xl px-4 font-medium placeholder:font-normal focus:outline-none"
          style={{
            background: "#111827",
            border: "1px solid #1F2937",
            color: "#F9FAFB",
            fontSize: large ? 18 : 16,
            height: 52,
            caretColor: "#3B82F6",
            transition: "border-color 150ms, box-shadow 150ms",
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "#3B82F6";
            e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.15)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "#1F2937";
            e.target.style.boxShadow = "none";
          }}
        />
        <button
          onClick={handleSearch}
          aria-label="Search for destination"
          className="cane-btn w-full flex items-center justify-center gap-2 rounded-xl font-bold"
          style={{
            background: "#3B82F6",
            color: "#fff",
            height: 52,
            fontSize: large ? 17 : 16,
            boxShadow: "0 4px 24px rgba(59,130,246,0.3)",
          }}
        >
          <Search size={18} />
          Search
        </button>
      </div>

      {/* ── Quick destinations ── */}
      <div className="flex gap-2 mb-6">
        {quickDests.map(({ emoji, label }) => (
          <button
            key={label}
            onClick={() => handleQuickDestination(label)}
            aria-label={`Quick destination: ${label}`}
            className="cane-btn flex-1 flex flex-col items-center gap-1.5 py-3 px-1.5 rounded-xl"
            style={{
              background: "#111827",
              border: "1px solid #1F2937",
            }}
          >
            <span style={{ fontSize: 20 }}>{emoji}</span>
            <span
              className="text-center font-medium leading-tight"
              style={{ color: "#9CA3AF", fontSize: 11 }}
            >
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* ── Settings link ── */}
      <div className="flex justify-center">
        <button
          onClick={() => navigate("settings")}
          aria-label="Open app settings"
          className="cane-btn flex items-center gap-1.5 px-4 py-2 rounded-full"
          style={{ color: "#4B5563", fontSize: 13 }}
        >
          <Settings size={14} />
          Settings
        </button>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 2 — CONFIRM DESTINATION
// ═══════════════════════════════════════════════════════════════════════════════
function ConfirmScreen({
  destination,
  goBack,
  caneConnected,
  setCaneConnected,
  handleStartNavigation,
  large,
}) {
  const addresses = {
    Home: "1234 Mesa Hills Dr, El Paso, TX 79912",
    "Nearest Hospital": "4815 Alameda Ave, El Paso, TX 79905",
    "Nearest Bus Stop": "Corner of Mesa St & Montana Ave, El Paso, TX 79902",
  };
  const address = addresses[destination] ?? "123 Main St, El Paso, TX 79901";

  return (
    <motion.div
      key="confirm"
      {...fade}
      className="flex flex-col min-h-screen"
      style={{ background: "#0A0E1A" }}
    >
      <TopBar
        onBack={goBack}
        caneConnected={caneConnected}
        setCaneConnected={setCaneConnected}
      />

      <div className="flex flex-col px-5 py-7 gap-6 flex-1">
        <h2
          className="font-bold"
          style={{ color: "#F9FAFB", fontSize: 28, letterSpacing: "-0.025em" }}
        >
          Your Destination
        </h2>

        {/* Card */}
        <div
          className="rounded-2xl p-5 flex flex-col gap-4"
          style={{
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.48)",
          }}
        >
          <div>
            <p
              className="font-bold"
              style={{
                color: "#F9FAFB",
                fontSize: large ? 24 : 22,
                letterSpacing: "-0.02em",
              }}
            >
              {destination}
            </p>
            <p
              className="mt-1.5"
              style={{ color: "#9CA3AF", fontSize: large ? 15 : 14 }}
            >
              {address}
            </p>
          </div>

          <div style={{ height: 1, background: "#1F2937" }} />

          <div className="flex gap-2 flex-wrap">
            {[
              { icon: "🚶", label: "12 min walk" },
              { icon: "📍", label: "0.8 miles away" },
            ].map(({ icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: "#111827", border: "1px solid #1F2937" }}
              >
                <span className="text-sm">{icon}</span>
                <span
                  className="font-medium"
                  style={{ color: "#9CA3AF", fontSize: 13 }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleStartNavigation}
            aria-label="Start navigation to this destination"
            className="cane-btn w-full flex items-center justify-center gap-2 rounded-xl font-bold"
            style={{
              background: "#3B82F6",
              color: "#fff",
              height: 56,
              fontSize: large ? 18 : 17,
              boxShadow: "0 4px 28px rgba(59,130,246,0.35)",
            }}
          >
            Start Navigation
            <ArrowRight size={20} />
          </button>

          <button
            onClick={goBack}
            aria-label="Change destination"
            className="cane-btn w-full flex items-center justify-center rounded-xl font-semibold"
            style={{
              background: "transparent",
              border: "1px solid #1F2937",
              color: "#9CA3AF",
              height: 50,
              fontSize: large ? 17 : 15,
            }}
          >
            Change Destination
          </button>
        </div>

        <p
          className="text-center mt-auto"
          style={{ color: "#374151", fontSize: 13, lineHeight: 1.7 }}
        >
          Your Wayve will guide you through vibration and servo movement.
        </p>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 3 — NAVIGATING
// ═══════════════════════════════════════════════════════════════════════════════
function NavigatingScreen({
  goBack,
  caneConnected,
  setCaneConnected,
  currentDirection,
  setCurrentDirection,
  progress,
  setProgress,
  currentStep,
  setCurrentStep,
  navSteps,
  currentStepIndex,
  tripDuration,
  tripDistance,
  navLoading,
  navError,
  liveDistance,
  handleStopNavigation,
  handleRepeatInstruction,
  handleSimulateArrival,
  large,
}) {
  const hasRealSteps = navSteps.length > 0;
  const totalSteps = hasRealSteps ? navSteps.length : 8;
  const currentInstruction = hasRealSteps
    ? navSteps[currentStepIndex]?.instruction
    : { straight: "Continue straight ahead", left: "Turn left", right: "Turn right" }[currentDirection];
  const distanceToNext = hasRealSteps
    ? navSteps[currentStepIndex]?.distance
    : "20 meters";

  const bumpProgress = () => {
    setProgress((p) => Math.min(p + 10, 100));
    setCurrentStep((s) => Math.min(s + 1, totalSteps));
  };

  return (
    <motion.div
      key="navigating"
      {...fade}
      className="flex flex-col min-h-screen"
      style={{ background: "#0A0E1A" }}
    >
      <TopBar
        onBack={goBack}
        caneConnected={caneConnected}
        setCaneConnected={setCaneConnected}
      />

      {/* Status sub-bar */}
      <div
        className="flex flex-col items-center py-3 gap-1 shrink-0"
        style={{ borderBottom: "1px solid #1F2937" }}
      >
        {navLoading ? (
          <p className="font-semibold text-sm" style={{ color: "#F59E0B" }}>
            📍 Getting your location…
          </p>
        ) : navError ? (
          <p className="font-semibold text-sm" style={{ color: "#EF4444" }}>{navError}</p>
        ) : hasRealSteps ? (
          <p className="font-semibold text-sm" style={{ color: "#10B981" }}>
            🗺 Live navigation · {tripDuration} · {tripDistance}
          </p>
        ) : (
          <p className="font-semibold text-sm" style={{ color: "#F59E0B" }}>
            Waiting for directions…
          </p>
        )}
        <p style={{ color: "#4B5563", fontSize: 11 }}>GPS updating continuously</p>
      </div>

      <div className="flex flex-col px-5 py-5 gap-5 flex-1">
        {/* Main directional card */}
        <div
          className="flex flex-col items-center justify-center gap-5 rounded-3xl p-6 flex-1"
          style={{
            background: "rgba(255,255,255,0.035)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 12px 48px rgba(0,0,0,0.5)",
            minHeight: 240,
          }}
        >
          <DirectionalArrow direction={currentDirection} />

          <div className="text-center">
            <p
              className="font-bold"
              style={{
                color: "#F9FAFB",
                fontSize: large ? 26 : 24,
                letterSpacing: "-0.02em",
                lineHeight: 1.25,
              }}
            >
              {navLoading ? "Finding your route…" : currentInstruction}
            </p>
            <p
              className="mt-2"
              style={{ color: "#9CA3AF", fontSize: large ? 16 : 14 }}
            >
              {hasRealSteps && liveDistance !== null
              ? `${liveDistance}m to next turn`
              : hasRealSteps
              ? `In approximately ${distanceToNext}`
              : "In approximately 20 meters"}
            </p>
          </div>

          {/* DEV: direction switcher */}
          <div className="flex gap-2 mt-1">
            {["left", "straight", "right"].map((dir) => (
              <button
                key={dir}
                onClick={() => setCurrentDirection(dir)}
                aria-label={`Test direction: ${dir}`}
                className="cane-btn px-3 py-1 rounded-full text-xs font-semibold"
                style={{
                  background: currentDirection === dir ? "#3B82F6" : "#1A2235",
                  color: currentDirection === dir ? "#fff" : "#4B5563",
                  border: `1px solid ${currentDirection === dir ? "rgba(59,130,246,0.5)" : "#1F2937"}`,
                  transition: "all 150ms ease",
                }}
              >
                {dir}
              </button>
            ))}
          </div>
        </div>

        {/* Progress */}
        <div className="flex flex-col gap-2">
          <div
            className="w-full rounded-full overflow-hidden"
            style={{ background: "#1A2235", height: 6 }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: "#3B82F6",
                boxShadow: "0 0 10px rgba(59,130,246,0.6)",
                transition: "width 500ms ease",
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <p style={{ color: "#9CA3AF", fontSize: 13 }}>
              {hasRealSteps
                ? `Step ${currentStepIndex + 1} of ${navSteps.length}`
                : `${currentStep} of ${totalSteps} steps`}
            </p>
            <p style={{ color: "#9CA3AF", fontSize: 13 }}>{Math.round(progress)}%</p>
          </div>
          <button
            onClick={bumpProgress}
            aria-label="Advance progress by 10 percent for testing"
            className="cane-btn self-start px-3 py-1 rounded-full text-xs font-medium"
            style={{
              background: "#1A2235",
              color: "#4B5563",
              border: "1px solid #1F2937",
            }}
          >
            +10% (test)
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={handleRepeatInstruction}
            aria-label="Repeat current navigation instruction aloud"
            className="cane-btn w-full flex items-center justify-center gap-2 rounded-xl font-semibold"
            style={{
              background: "#111827",
              border: "1px solid #1F2937",
              color: "#F9FAFB",
              height: 50,
              fontSize: large ? 17 : 15,
            }}
          >
            <Volume2 size={18} />
            Repeat Instruction 🔊
          </button>

          <button
            onClick={handleSimulateArrival}
            aria-label="Simulate arrival for testing"
            className="cane-btn w-full flex items-center justify-center rounded-xl font-medium"
            style={{
              background: "transparent",
              border: "1px solid #1A2235",
              color: "#374151",
              height: 40,
              fontSize: 12,
            }}
          >
            Simulate Arrival (dev)
          </button>

          <button
            onClick={handleStopNavigation}
            aria-label="Stop navigation and return to home"
            className="cane-btn w-full flex items-center justify-center gap-2 rounded-xl font-bold"
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.22)",
              color: "#EF4444",
              height: 52,
              fontSize: large ? 17 : 16,
            }}
          >
            <StopCircle size={20} />
            Stop Navigation
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 4 — ARRIVED
// ═══════════════════════════════════════════════════════════════════════════════
function ArrivedScreen({
  destination,
  navigate,
  handleShareLocation,
  arrived,
  large,
}) {
  return (
    <motion.div
      key="arrived"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col min-h-screen items-center justify-center px-6 gap-8"
      style={{ background: "#0A0E1A" }}
    >
      <motion.div
        initial={{ scale: 0.3, opacity: 0 }}
        animate={arrived ? { scale: 1, opacity: 1 } : { scale: 0.3, opacity: 0 }}
        transition={{ type: "spring", stiffness: 175, damping: 18, delay: 0.1 }}
      >
        <CheckCircle
          size={88}
          color="#10B981"
          strokeWidth={1.5}
          aria-label="You have arrived"
        />
      </motion.div>

      <div className="text-center flex flex-col gap-2">
        <h2
          className="font-black"
          style={{
            color: "#F9FAFB",
            fontSize: large ? 40 : 36,
            letterSpacing: "-0.035em",
          }}
        >
          You've Arrived
        </h2>
        <p style={{ color: "#9CA3AF", fontSize: large ? 17 : 16 }}>
          {destination}
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full">
        <button
          onClick={() => navigate("home")}
          aria-label="Start a new navigation"
          className="cane-btn w-full flex items-center justify-center rounded-xl font-bold"
          style={{
            background: "#3B82F6",
            color: "#fff",
            height: 56,
            fontSize: large ? 18 : 17,
            boxShadow: "0 4px 28px rgba(59,130,246,0.35)",
          }}
        >
          Navigate Again
        </button>

        <button
          onClick={handleShareLocation}
          aria-label="Share your current location"
          className="cane-btn w-full flex items-center justify-center gap-2 rounded-xl font-semibold"
          style={{
            background: "transparent",
            border: "1px solid #1F2937",
            color: "#9CA3AF",
            height: 50,
            fontSize: large ? 17 : 15,
          }}
        >
          Share Location
        </button>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 5 — SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════
function SettingsScreen({
  goBack,
  caneConnected,
  setCaneConnected,
  arduinoIP,
  setArduinoIP,
  walkingSpeed,
  setWalkingSpeed,
  updateFrequency,
  setUpdateFrequency,
  voiceFeedback,
  setVoiceFeedback,
  hapticConfirmation,
  setHapticConfirmation,
  largeTextMode,
  setLargeTextMode,
  language,
  setLanguage,
  handleTestConnection,
  mapsStatus,
  handleTestMapsAPI,
  large,
}) {
  const card = {
    background: "#111827",
    border: "1px solid #1F2937",
    borderRadius: 16,
    marginInline: 20,
    overflow: "hidden",
  };

  return (
    <motion.div
      key="settings"
      {...fade}
      className="flex flex-col min-h-screen"
      style={{ background: "#0A0E1A" }}
    >
      <TopBar
        onBack={goBack}
        caneConnected={caneConnected}
        setCaneConnected={setCaneConnected}
      />

      <div className="flex-1 overflow-y-auto pb-24">
        <h2
          className="px-5 pt-7 pb-1 font-bold"
          style={{ color: "#F9FAFB", fontSize: 28, letterSpacing: "-0.025em" }}
        >
          Settings
        </h2>

        {/* Device */}
        <SectionDivider label="Device" />
        <div style={card}>
          <SettingRow
            label="Arduino IP Address"
            description="Local network address of your smart cane"
            large={large}
            control={
              <input
                type="text"
                value={arduinoIP}
                onChange={(e) => setArduinoIP(e.target.value)}
                aria-label="Arduino IP address"
                className="rounded-lg px-3 font-mono text-right focus:outline-none"
                style={{
                  background: "#0A0E1A",
                  border: "1px solid #1F2937",
                  color: "#F9FAFB",
                  fontSize: 13,
                  height: 36,
                  width: 130,
                  caretColor: "#3B82F6",
                  transition: "border-color 150ms",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#3B82F6")}
                onBlur={(e) => (e.target.style.borderColor = "#1F2937")}
              />
            }
          />
          <div className="px-5 pb-4 pt-1">
            <button
              onClick={handleTestConnection}
              aria-label="Test connection to cane device"
              className="cane-btn flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm"
              style={{
                background: caneConnected ? "rgba(16,185,129,0.1)" : "#1A2235",
                border: `1px solid ${caneConnected ? "rgba(16,185,129,0.35)" : "#1F2937"}`,
                color: caneConnected ? "#10B981" : "#9CA3AF",
                transition: "all 200ms ease",
              }}
            >
              {caneConnected ? "🟢 Connected" : "🔴 Test Connection"}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <SectionDivider label="Navigation" />
        <div style={card}>
          <SettingRow
            label="Walking speed"
            description="Adjusts instruction pacing"
            large={large}
            control={
              <PillSelector
                options={["Slow", "Normal", "Fast"]}
                value={walkingSpeed}
                onChange={setWalkingSpeed}
              />
            }
          />
          <SettingRow
            label="Update frequency"
            description="How often the cane polls for position"
            large={large}
            control={
              <PillSelector
                options={["1s", "3s", "5s"]}
                value={updateFrequency}
                onChange={setUpdateFrequency}
              />
            }
          />
        </div>

        {/* Accessibility */}
        <SectionDivider label="Accessibility" />
        <div style={card}>
          <SettingRow
            label="Voice feedback"
            description="Speak turn-by-turn instructions aloud"
            large={large}
            control={
              <Toggle
                value={voiceFeedback}
                onChange={setVoiceFeedback}
                ariaLabel="Toggle voice feedback"
              />
            }
          />
          <SettingRow
            label="Haptic confirmation"
            description="Vibrate when a new route begins"
            large={large}
            control={
              <Toggle
                value={hapticConfirmation}
                onChange={setHapticConfirmation}
                ariaLabel="Toggle haptic confirmation"
              />
            }
          />
          <SettingRow
            label="Large text mode"
            description="Increases font sizes throughout the app"
            large={large}
            control={
              <Toggle
                value={largeTextMode}
                onChange={setLargeTextMode}
                ariaLabel="Toggle large text mode"
              />
            }
          />
        </div>

        {/* Google Maps */}
        <SectionDivider label="Google Maps" />
        <div style={card}>
          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <p className="font-medium" style={{ color: "#F9FAFB", fontSize: large ? 17 : 15 }}>
                Directions API
              </p>
              <p style={{ color: "#6B7280", fontSize: 12 }}>
                {mapsStatus === "ok"  && "✅ Key is valid and working"}
                {mapsStatus === "error" && "❌ Key invalid or request failed"}
                {mapsStatus === "loading" && "Testing…"}
                {mapsStatus === null && "Tap to verify your API key"}
              </p>
            </div>
            <button
              onClick={handleTestMapsAPI}
              disabled={mapsStatus === "loading"}
              aria-label="Test Google Maps API key"
              className="cane-btn px-4 py-2 rounded-lg font-semibold text-sm"
              style={{
                background:
                  mapsStatus === "ok"    ? "rgba(16,185,129,0.1)"  :
                  mapsStatus === "error" ? "rgba(239,68,68,0.1)"   : "#1A2235",
                border: `1px solid ${
                  mapsStatus === "ok"    ? "rgba(16,185,129,0.35)" :
                  mapsStatus === "error" ? "rgba(239,68,68,0.3)"   : "#1F2937"
                }`,
                color:
                  mapsStatus === "ok"    ? "#10B981" :
                  mapsStatus === "error" ? "#EF4444"  : "#9CA3AF",
                opacity: mapsStatus === "loading" ? 0.6 : 1,
              }}
            >
              {mapsStatus === "loading" ? "Testing…" : "Test Key"}
            </button>
          </div>
        </div>

        {/* Language */}
        <SectionDivider label="Language" />
        <div style={{ ...card, marginBottom: 8 }}>
          <SettingRow
            label="App language"
            description="Voice instructions and UI language"
            large={large}
            control={
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                aria-label="Select app language"
                className="rounded-lg px-3 focus:outline-none"
                style={{
                  background: "#0A0E1A",
                  border: "1px solid #1F2937",
                  color: "#F9FAFB",
                  fontSize: 13,
                  height: 36,
                }}
              >
                <option value="English">English</option>
                <option value="Spanish">Español</option>
              </select>
            }
          />
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT — CaneApp (single default export)
// ═══════════════════════════════════════════════════════════════════════════════
export default function WayveApp() {
  // ── Routing ──
  const [currentScreen, setCurrentScreen] = useState("home");
  const [screenHistory, setScreenHistory] = useState([]);

  // ── Device ──
  const [caneConnected, setCaneConnected] = useState(false);

  // ── Home ──
  const [isListening, setIsListening] = useState(false);
  const [destinationInput, setDestinationInput] = useState("");
  const [destination, setDestination] = useState("");

  // ── Navigation ──
  const [currentDirection, setCurrentDirection] = useState("straight");
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  // ── Real directions ──
  const [navSteps, setNavSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [tripDuration, setTripDuration] = useState("");
  const [tripDistance, setTripDistance] = useState("");
  const [navLoading, setNavLoading] = useState(false);
  const [navError, setNavError] = useState(null);
  const [liveDistance, setLiveDistance] = useState(null); // meters to next step
  const navStepsRef = useRef([]);
  const stepIndexRef = useRef(0);

  // ── Arrived ──
  const [arrived, setArrived] = useState(false);

  // ── Maps API test ──
  const [mapsStatus, setMapsStatus] = useState(null); // null | "loading" | "ok" | "error"

  // ── Settings ──
  const [arduinoIP, setArduinoIP] = useState("192.168.1.x");
  const [walkingSpeed, setWalkingSpeed] = useState("Normal");
  const [updateFrequency, setUpdateFrequency] = useState("3s");
  const [voiceFeedback, setVoiceFeedback] = useState(true);
  const [hapticConfirmation, setHapticConfirmation] = useState(true);
  const [largeTextMode, setLargeTextMode] = useState(false);
  const [language, setLanguage] = useState("English");

  // ── Navigation helpers ──
  const navigate = (screen) => {
    setScreenHistory((prev) => [...prev, currentScreen]);
    setCurrentScreen(screen);
  };

  const goBack = () => {
    setScreenHistory((prev) => {
      const next = [...prev];
      const last = next.pop() ?? "home";
      setCurrentScreen(last);
      return next;
    });
  };

  // ── Placeholder handlers ──

  const handleMicPress = () => {
    setIsListening((v) => !v);
    // TODO: connect to backend — start/stop SpeechRecognition Web API and send transcript to navigation service
  };

  const handleSearch = () => {
    if (!destinationInput.trim()) return;
    setDestination(destinationInput.trim());
    navigate("confirm");
    // TODO: connect to backend — geocode destination string via /api/geocode
  };

  const handleQuickDestination = (dest) => {
    setDestination(dest);
    navigate("confirm");
    // TODO: connect to backend — resolve preset destinations from user profile or nearest-POI API
  };

  const handleStartNavigation = async () => {
    setProgress(0);
    setCurrentStep(0);
    setCurrentStepIndex(0);
    setNavSteps([]);
    setNavError(null);
    setNavLoading(true);
    navigate("navigating");

    try {
      const key = import.meta.env.VITE_GOOGLE_MAPS_KEY;
      await loadGoogleMapsScript(key);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          const service = new window.google.maps.DirectionsService();
          service.route(
            {
              origin,
              destination,
              travelMode: window.google.maps.TravelMode.WALKING,
            },
            (result, status) => {
              setNavLoading(false);
              if (status !== "OK") { setNavError("Could not find directions."); return; }
              const leg = result.routes[0].legs[0];
              const steps = leg.steps.map((s) => ({
                instruction: stripHtml(s.instructions),
                distance: s.distance.text,
                maneuver: s.maneuver ?? "",
                endLat: s.end_location.lat(),
                endLng: s.end_location.lng(),
              }));
              setNavSteps(steps);
              navStepsRef.current = steps;
              stepIndexRef.current = 0;
              setTripDuration(leg.duration.text);
              setTripDistance(leg.distance.text);
              setCurrentDirection(maneuverToDirection(steps[0]?.maneuver));
              setProgress(0);
              setCurrentStep(0);
            }
          );
        },
        () => { setNavLoading(false); setNavError("Location access denied."); },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } catch (e) {
      setNavLoading(false);
      setNavError("Failed to load Maps.");
    }
  };

  const handleStopNavigation = () => {
    setProgress(0);
    setCurrentStep(0);
    setCurrentStepIndex(0);
    setNavSteps([]);
    navStepsRef.current = [];
    navigate("home");
  };

  const handleRepeatInstruction = () => {
    const step = navStepsRef.current[stepIndexRef.current];
    const text = step?.instruction || "Continue straight ahead";
    const utt = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utt);
  };

  const handleShareLocation = () => {
    // TODO: connect to backend — call navigator.share({ url, text }) with current GPS coordinates
  };

  const handleTestConnection = () => {
    setCaneConnected((v) => !v); // demo toggle
    // TODO: connect to backend — fetch(`http://${arduinoIP}/ping`).then(updateCaneConnected)
  };

  const handleTestMapsAPI = async () => {
    setMapsStatus("loading");
    try {
      const key = import.meta.env.VITE_GOOGLE_MAPS_KEY;
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=El+Paso,TX&key=${key}`
      );
      const data = await res.json();
      console.log("Maps API response:", data.status, data.error_message);
      setMapsStatus(data.status === "OK" ? "ok" : "error");
    } catch (e) {
      console.log("Maps API fetch error:", e.message);
      setMapsStatus("error");
    }
  };

  const handleSimulateArrival = () => {
    // TODO: connect to backend — remove this; arrival is pushed by backend WebSocket event
    setProgress(100);
    setCurrentStep(totalSteps);
    setTimeout(() => {
      setArrived(false);
      navigate("arrived");
      setTimeout(() => setArrived(true), 120);
    }, 350);
  };

  // ── GPS watch while navigating ──
  useEffect(() => {
    if (currentScreen !== "navigating") return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const steps = navStepsRef.current;
        const idx = stepIndexRef.current;
        if (!steps.length) return;

        const step = steps[idx];
        const dist = haversineDistance(lat, lng, step.endLat, step.endLng);

        // Always update live distance so UI re-renders every GPS fix
        setLiveDistance(Math.round(dist));

        if (dist < 20) {
          const next = idx + 1;
          if (next < steps.length) {
            stepIndexRef.current = next;
            setCurrentStepIndex(next);
            setCurrentStep(next);
            setCurrentDirection(maneuverToDirection(steps[next].maneuver));
            setProgress(Math.round(((next + 1) / steps.length) * 100));
            setLiveDistance(null);
            const utt = new SpeechSynthesisUtterance(steps[next].instruction);
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utt);
          } else {
            setProgress(100);
            setCurrentStep(steps.length);
            setTimeout(() => {
              setArrived(false);
              navigate("arrived");
              setTimeout(() => setArrived(true), 120);
            }, 500);
          }
        }
      },
      (err) => console.warn("GPS error:", err.message),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [currentScreen]); // eslint-disable-line

  const shared = {
    large: largeTextMode,
    caneConnected,
    setCaneConnected,
  };

  return (
    /* Outer shell — dark surround on desktop */
    <div
      className="min-h-screen flex items-start justify-center"
      style={{ background: "#050810" }}
    >
      {/* Phone-width container */}
      <div
        className="relative w-full"
        style={{ maxWidth: 430, minHeight: "100vh", background: "#0A0E1A" }}
      >
        <AnimatePresence mode="wait">
          {currentScreen === "home" && (
            <HomeScreen
              key="home"
              {...shared}
              navigate={navigate}
              isListening={isListening}
              handleMicPress={handleMicPress}
              destinationInput={destinationInput}
              setDestinationInput={setDestinationInput}
              handleSearch={handleSearch}
              handleQuickDestination={handleQuickDestination}
            />
          )}

          {currentScreen === "confirm" && (
            <ConfirmScreen
              key="confirm"
              {...shared}
              destination={destination}
              goBack={goBack}
              handleStartNavigation={handleStartNavigation}
            />
          )}

          {currentScreen === "navigating" && (
            <NavigatingScreen
              key="navigating"
              {...shared}
              destination={destination}
              goBack={goBack}
              currentDirection={currentDirection}
              setCurrentDirection={setCurrentDirection}
              progress={progress}
              setProgress={setProgress}
              currentStep={currentStep}
              setCurrentStep={setCurrentStep}
              navSteps={navSteps}
              currentStepIndex={currentStepIndex}
              tripDuration={tripDuration}
              tripDistance={tripDistance}
              navLoading={navLoading}
              navError={navError}
              liveDistance={liveDistance}
              handleStopNavigation={handleStopNavigation}
              handleRepeatInstruction={handleRepeatInstruction}
              handleSimulateArrival={handleSimulateArrival}
            />
          )}

          {currentScreen === "arrived" && (
            <ArrivedScreen
              key="arrived"
              {...shared}
              destination={destination}
              navigate={navigate}
              handleShareLocation={handleShareLocation}
              arrived={arrived}
            />
          )}

          {currentScreen === "settings" && (
            <SettingsScreen
              key="settings"
              {...shared}
              goBack={goBack}
              arduinoIP={arduinoIP}
              setArduinoIP={setArduinoIP}
              walkingSpeed={walkingSpeed}
              setWalkingSpeed={setWalkingSpeed}
              updateFrequency={updateFrequency}
              setUpdateFrequency={setUpdateFrequency}
              voiceFeedback={voiceFeedback}
              setVoiceFeedback={setVoiceFeedback}
              hapticConfirmation={hapticConfirmation}
              setHapticConfirmation={setHapticConfirmation}
              largeTextMode={largeTextMode}
              setLargeTextMode={setLargeTextMode}
              language={language}
              setLanguage={setLanguage}
              handleTestConnection={handleTestConnection}
              mapsStatus={mapsStatus}
              handleTestMapsAPI={handleTestMapsAPI}
            />
          )}
        </AnimatePresence>

        {/* DEV MODE — floating pill, bottom-right */}
        <div
          className="fixed bottom-5 right-5 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono z-50 select-none pointer-events-none"
          style={{
            background: "rgba(59,130,246,0.09)",
            border: "1px solid rgba(59,130,246,0.22)",
            color: "#60A5FA",
            backdropFilter: "blur(8px)",
          }}
        >
          DEV · {currentScreen} · {caneConnected ? "🟢" : "🔴"}
        </div>
      </div>
    </div>
  );
}
