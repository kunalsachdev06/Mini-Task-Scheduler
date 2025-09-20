// Header.js
import React from "react";
import logo from "./assets/logo.png"; // ✅ adjust path if you put in /assets
import Header from "./header";

function Header() {
  return (
    <header className="header-container">
      {/* Logo */}
      <img
        src={logo}
        alt="Logo"
        className="header-logo"
      />

      {/* App Name */}
      <h1 className="header-title">
        Mini Task Scheduler
      </h1>

      {/* Nav Menu */}
      <nav className="header-nav">
        <a href="/dashboard">Dashboard</a>
        <a href="/history">History</a>
        <a href="/about">About</a>
      </nav>
    </header>
  );
}

export default Header;
