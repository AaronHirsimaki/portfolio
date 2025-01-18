import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-link">
          Home
        </Link>
        <Link to="/goals" className="navbar-link">
          Goals
        </Link>
        <Link to="/important" className="navbar-link">
          Important
        </Link>
      </div>
    </nav>
  );
}
