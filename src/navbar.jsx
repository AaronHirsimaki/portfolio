import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav>
      <Link to="/" style={{ margin: "0 1rem" }}>
        Home
      </Link>
      <Link to="/goals" style={{ margin: "0 1rem" }}>
        Goals
      </Link>
      <Link to="/important" style={{ margin: "0 1rem" }}>
        Important
      </Link>
    </nav>
  );
}
