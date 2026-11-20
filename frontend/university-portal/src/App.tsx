import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RequireRole } from './components/RequireRole';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';

// Chargement différé des vues secondaires : leur code n'est téléchargé qu'à l'ouverture de la page
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const DiplomaDetail = lazy(() => import('./pages/DiplomaDetail').then((m) => ({ default: m.DiplomaDetail })));
const DiplomaList = lazy(() => import('./pages/DiplomaList').then((m) => ({ default: m.DiplomaList })));
const Issue = lazy(() => import('./pages/Issue').then((m) => ({ default: m.Issue })));
const MyDiplomas = lazy(() => import('./pages/MyDiplomas').then((m) => ({ default: m.MyDiplomas })));
const Privacy = lazy(() => import('./pages/Legal').then((m) => ({ default: m.Privacy })));
const PublicVerify = lazy(() => import('./pages/PublicVerify').then((m) => ({ default: m.PublicVerify })));
const RequestAccess = lazy(() => import('./pages/RequestAccess').then((m) => ({ default: m.RequestAccess })));
const Terms = lazy(() => import('./pages/Legal').then((m) => ({ default: m.Terms })));
const Verify = lazy(() => import('./pages/Verify').then((m) => ({ default: m.Verify })));

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="request-access" element={<RequestAccess />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />
        <Route path="v/:token" element={<PublicVerify />} />
        <Route path="issue" element={<RequireRole roles={['university']}><Issue /></RequireRole>} />
        <Route path="dashboard" element={<RequireRole roles={['ministry', 'university']}><Dashboard /></RequireRole>} />
        <Route path="diplomas" element={<RequireRole roles={['university', 'ministry']}><DiplomaList /></RequireRole>} />
        <Route
          path="diplomas/:id"
          element={<RequireRole roles={['university', 'ministry', 'recruiter', 'student']}><DiplomaDetail /></RequireRole>}
        />
        <Route path="my-diplomas" element={<RequireRole roles={['student']}><MyDiplomas /></RequireRole>} />
        <Route path="verify" element={<RequireRole roles={['recruiter', 'university', 'ministry']}><Verify /></RequireRole>} />
        <Route path="404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
    </Routes>
  );
}
