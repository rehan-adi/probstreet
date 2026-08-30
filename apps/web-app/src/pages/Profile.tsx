import api from '@/config/axios';
import { useEffect, useState } from 'react';
import defaultThumbnail from '@/assets/images/logo.avif';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, TrendingUp, Trophy, BarChart2, CalendarDays } from 'lucide-react';

interface PublicProfile {
	id: string;
	username: string;
	bio: string | null;
	avatarUrl: string | null;
	joinedAt: string;
	stats: {
		tradesCount: number;
		openPositions: number;
		netProfit: number;
	};
	positions: Array<{
		yesQuantity: number;
		noQuantity: number;
		yesInvested: number;
		noInvested: number;
		market: {
			id: string;
			title: string;
			symbol: string;
			yesPrice: number;
			noPrice: number;
			thumbnail: string | null;
			status: string;
			endTime: string;
		};
	}>;
}

export default function ProfilePage() {
	const { username } = useParams<{ username: string }>();
	const navigate = useNavigate();
	const [profile, setProfile] = useState<PublicProfile | null>(null);
	const [loading, setLoading] = useState(true);
	const [notFound, setNotFound] = useState(false);

	useEffect(() => {
		if (!username) {
			navigate('/settings');
			return;
		}

		const fetchProfile = async () => {
			try {
				const res = await api.get(`/profile/${username}`);
				if (res.data?.success) {
					setProfile(res.data.data);
				} else {
					setNotFound(true);
				}
			} catch (err: any) {
				if (err.response?.status === 404) {
					setNotFound(true);
				}
			} finally {
				setLoading(false);
			}
		};

		fetchProfile();
	}, [username, navigate]);

	if (loading) {
		return (
			<div className="flex justify-center items-center min-h-[60vh]">
				<Loader2 className="animate-spin w-8 h-8 text-foreground" />
			</div>
		);
	}

	if (notFound || !profile) {
		return (
			<div className="flex flex-col justify-center items-center min-h-[60vh] gap-3">
				<p className="text-2xl font-bold">User not found</p>
				<p className="text-muted-foreground text-sm">@{username} doesn't exist on Probstreet</p>
				<Link to="/events" className="text-sm underline text-muted-foreground mt-2">
					Browse Markets
				</Link>
			</div>
		);
	}

	const netProfitPositive = profile.stats.netProfit >= 0;
	const joinedDate = new Date(profile.joinedAt).toLocaleDateString('en-IN', {
		month: 'long',
		year: 'numeric',
	});

	return (
		<div className="max-w-3xl mx-auto px-4 py-10 w-full">
			{/* Profile Card */}
			<div className="bg-card border border-border rounded-2xl overflow-hidden">
				{/* Banner */}
				<div className="h-32 w-full bg-linear-to-r from-blue-500 via-indigo-500 to-purple-600" />

				<div className="px-6 pb-6 relative">
					{/* Avatar */}
					<div className="-mt-12 mb-4">
						<div className="w-24 h-24 rounded-full border-4 border-card bg-muted flex items-center justify-center overflow-hidden">
							{profile.avatarUrl ? (
								<img
									src={profile.avatarUrl}
									alt={profile.username || ''}
									className="w-full h-full object-cover"
								/>
							) : (
								<span className="text-3xl font-bold text-muted-foreground">
									{profile.username?.charAt(0).toUpperCase() || '?'}
								</span>
							)}
						</div>
					</div>

					{/* Name + bio */}
					<h1 className="text-xl font-bold">@{profile.username}</h1>
					{profile.bio && (
						<p className="text-muted-foreground text-sm mt-1 max-w-lg">{profile.bio}</p>
					)}
					<div className="flex items-center gap-1.5 mt-2 text-muted-foreground text-xs">
						<CalendarDays className="w-3.5 h-3.5" />
						<span>Joined {joinedDate}</span>
					</div>

					{/* Stats */}
					<div className="grid grid-cols-3 gap-3 mt-6">
						<div className="bg-muted/40 rounded-xl p-4">
							<div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
								<BarChart2 className="w-4 h-4" />
								<span className="text-xs font-medium">Trades</span>
							</div>
							<div className="text-xl font-bold">
								{profile.stats.tradesCount.toLocaleString('en-IN')}
							</div>
						</div>

						<div className="bg-muted/40 rounded-xl p-4">
							<div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
								<TrendingUp className="w-4 h-4" />
								<span className="text-xs font-medium">Open Markets</span>
							</div>
							<div className="text-xl font-bold">{profile.stats.openPositions}</div>
						</div>

						<div className="bg-muted/40 rounded-xl p-4">
							<div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
								<Trophy className="w-4 h-4" />
								<span className="text-xs font-medium">Net P&L</span>
							</div>
							<div
								className={`text-xl font-bold ${
									netProfitPositive
										? 'text-emerald-600 dark:text-emerald-400'
										: 'text-red-500 dark:text-red-400'
								}`}
							>
								{netProfitPositive ? '+' : ''}₹
								{Math.abs(profile.stats.netProfit).toLocaleString('en-IN', {
									minimumFractionDigits: 2,
									maximumFractionDigits: 2,
								})}
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Current Positions */}
			{profile.positions.length > 0 && (
				<div className="mt-6">
					<h2 className="text-base font-semibold mb-3">Current Positions</h2>
					<div className="flex flex-col gap-3">
						{profile.positions.map((pos, i) => {
							const hasYes = pos.yesQuantity > 0;
							const hasNo = pos.noQuantity > 0;
							return (
								<Link
									key={i}
									to={`/events/${pos.market.symbol}`}
									className="bg-card border border-border rounded-xl p-4 flex items-start gap-4 hover:border-foreground/30 transition-colors"
								>
									<img
										src={pos.market.thumbnail || defaultThumbnail}
										alt={pos.market.title}
										className="w-12 h-12 rounded-lg object-cover shrink-0 border border-border"
									/>
									<div className="flex-1 min-w-0">
										<p className="text-sm font-medium line-clamp-2 leading-snug">
											{pos.market.title}
										</p>
										<div className="flex gap-2 mt-2">
											{hasYes && (
												<span className="text-xs font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded">
													YES × {pos.yesQuantity}
												</span>
											)}
											{hasNo && (
												<span className="text-xs font-bold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded">
													NO × {pos.noQuantity}
												</span>
											)}
										</div>
									</div>
									<div className="text-right shrink-0">
										<span
											className={`text-xs font-semibold px-2 py-1 rounded-full ${
												pos.market.status === 'OPEN'
													? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
													: 'bg-gray-100 dark:bg-gray-800 text-gray-500'
											}`}
										>
											{pos.market.status}
										</span>
									</div>
								</Link>
							);
						})}
					</div>
				</div>
			)}

			{profile.positions.length === 0 && (
				<div className="mt-6 text-center py-10 text-muted-foreground text-sm bg-card border border-border rounded-2xl">
					No open positions right now
				</div>
			)}
		</div>
	);
}
