import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./navbar";
import Homepage from "./screens/Homepage";
import Important from "./screens/Important";
import Goals from "./screens/Goals";
import Contacts from "./screens/Contacts";

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/important" element={<Important />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/contacts" element={<Contacts />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
