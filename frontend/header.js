// Header.js
import React from "react";
import logo from "./assets/logo.png"; // ✅ adjust path if you put in /assets
import Header from "./header";

function Header() {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        padding: "10px 20px",
        borderBottom: "1px solid #ddd",
      }}
    >
      {/* Logo */}
      <img
        src={logo}
        alt="Logo"
        style={{ height: "40px", marginRight: "10px" }}
      />

      {/* App Name */}
      <h1 style={{ fontSize: "1.2rem", fontWeight: "bold" }}>
        Mini Task Scheduler
      </h1>

      {/* Nav Menu */}
      <nav style={{ marginLeft: "auto", display: "flex", gap: "20px" }}>
        <a href="/dashboard">Dashboard</a>
        <a href="/history">History</a>
        <a href="/about">About</a>
      </nav>
    </header>
  );
}

export default Header;
