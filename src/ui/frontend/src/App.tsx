import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import SearchPage from './pages/SearchPage';
import DashboardPage from './pages/DashboardPage';

function App() {
    return (
        <Router>
            <div className="min-h-screen bg-slate-50">
                <Header />
                <Routes>
                    <Route path="/" element={<SearchPage />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
