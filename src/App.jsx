import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import GlobalStyle from "./styles.js";
import GridOverlay from "./components/GridOverlay.jsx";
import Navigation from "./components/Navigation.jsx";
import Current from "./pages/Current/Current.jsx";
import Past from "./pages/Past/Past.jsx";
import OurPractice from "./pages/OurPractice/OurPractice.jsx";
import ProjectList from "./pages/ProjectList/ProjectList.jsx";

function App() {
  return (
    <BrowserRouter>
      <GlobalStyle />
      {import.meta.env.DEV && <GridOverlay />}
      <Navigation />
      <Routes>
        <Route path="/" element={<Current />} />
        <Route path="/current" element={<Navigate to="/" replace />} />
        <Route path="/past" element={<Past />} />
        <Route path="/project-list" element={<ProjectList />} />
        <Route path="/our-practice" element={<OurPractice />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
