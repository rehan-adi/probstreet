import { Toaster } from 'sonner';
import { useEffect } from 'react';
import BlogPage from '@/pages/Blog';
import AboutPage from '@/pages/About';
import TermsPage from '@/pages/Terms';
import { Loader2 } from 'lucide-react';
import EventsPage from '@/pages/Events';
import WalletPage from '@/pages/Wallet';
import SearchPage from '@/pages/Search';
import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';
import Portfolio from '@/pages/Portfolio';
import ProfilePage from '@/pages/Profile';
import PrivateRoute from './PrivateRoute';
import PrivacyPage from '@/pages/Privacy';
import AdminDashboard from '@/pages/Admin';
import RechargePage from '@/pages/Recharge';
import WithdrawPage from '@/pages/Withdraw';
import SettingsPage from '@/pages/Settings';
import NotFoundPage from '@/pages/NotFound';
import { useAuthStore } from '@/store/auth';
import WishlistPage from '@/pages/Wishlist';
import ReferralPage from '@/pages/Referral';
import AdminUsers from '@/pages/admin/Users';
import EventDetails from '@/pages/EventDetails';
import AdminMarkets from '@/pages/admin/Markets';
import LeaderboardPage from '@/pages/Leaderboard';
import CreateEvent from '@/pages/admin/CreateEvent';
import VerificationgePage from '@/pages/Verification';
import ControlCentrePage from '@/pages/ControlCentre';
import AuthModal from '@/components/modals/AuthModal';
import AdminTransactions from '@/pages/admin/Transactions';
import AdminVerifications from '@/pages/admin/Verifications';
import TransactionHistoryPage from '@/pages/TransactionHistory';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import { useThemeStore } from '@/store/theme';
import { useModalStore } from '@/store/modal';

function AppContent() {
	const location = useLocation();
	const isAdminRoute = location.pathname.startsWith('/dashboard');
	const user = useAuthStore((state) => state.user);

	if (user?.role === 'ADMIN' && !isAdminRoute) {
		return <Navigate to="/dashboard/home" replace />;
	}

	return (
		<div className={`flex flex-col ${isAdminRoute ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
			{!isAdminRoute && <Navbar />}
			<AuthModal />
			<main className={!isAdminRoute ? 'grow pt-16' : 'grow h-full overflow-hidden'}>
				<Routes>
					{/* public routes  */}
					<Route
						path="/"
						element={
							<Navigate to={user?.role === 'ADMIN' ? '/dashboard/home' : '/events'} replace />
						}
					/>
					<Route path="/events" element={<EventsPage />} />
					<Route path="/events/:symbol" element={<EventDetails />} />
					<Route path="/search" element={<SearchPage />} />
					<Route path="/leaderboard" element={<LeaderboardPage />} />
					<Route path="/referral" element={<ReferralPage />} />

					<Route path="/about" element={<AboutPage />} />
					<Route path="/blog" element={<BlogPage />} />
					<Route path="/privacy" element={<PrivacyPage />} />
					<Route path="/terms" element={<TermsPage />} />

					{/* all private routes */}
					<Route element={<PrivateRoute />}>
						<Route path="/wallet">
							<Route index element={<WalletPage />} />
							<Route path="recharge" element={<RechargePage />} />
							<Route path="withdraw" element={<WithdrawPage />} />
							<Route path="control-centre" element={<ControlCentrePage />} />
						</Route>
						<Route path="/portfolio" element={<Portfolio />} />
						<Route path="/wishlist" element={<WishlistPage />} />
						<Route path="/settings" element={<SettingsPage />} />
						<Route path="/profile/:username" element={<ProfilePage />} />
						<Route path="/profile" element={<Navigate to="/settings" replace />} />
						<Route path="/verification" element={<VerificationgePage />} />
						<Route path="/transaction-history" element={<TransactionHistoryPage />} />

						{/* Admin Routes */}
						<Route path="/dashboard/home" element={<AdminDashboard />} />
						<Route path="/dashboard/verifications" element={<AdminVerifications />} />
						<Route path="/dashboard/markets" element={<AdminMarkets />} />
						<Route path="/dashboard/markets/create" element={<CreateEvent />} />
						<Route path="/dashboard/users" element={<AdminUsers />} />
						<Route path="/dashboard/transactions" element={<AdminTransactions />} />
					</Route>
					<Route path="*" element={<NotFoundPage />} />
				</Routes>
			</main>
			{!isAdminRoute && <Footer />}
		</div>
	);
}

function App() {
	const hydrate = useAuthStore((state) => state.hydrate);
	const isHydrated = useAuthStore((state) => state.isHydrated);
	const theme = useThemeStore((state) => state.theme);

	useEffect(() => {
		hydrate();
		if (theme === 'dark') {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	}, [theme, hydrate]);

	const user = useAuthStore((state) => state.user);
	useEffect(() => {
		if (isHydrated && user && user.onboardingStatus !== 'COMPLETED') {
			useModalStore.getState().openOnboardModal();
		}
	}, [isHydrated, user]);

	if (!isHydrated) {
		return (
			<div className="w-full bg-[#f4f4f5] flex justify-center items-center h-screen">
				<Loader2 className="animate-spin w-8 h-8" />
			</div>
		);
	}

	return (
		<BrowserRouter>
			<Toaster position="bottom-center" richColors />
			<AppContent />
		</BrowserRouter>
	);
}

export default App;
