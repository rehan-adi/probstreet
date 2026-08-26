import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from '@/hooks/useDebounce';
import { useState, useEffect, useRef } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { Search, X, Flame, TrendingUp, Clock, Target, DollarSign, Activity } from 'lucide-react';

const BROWSE_CATEGORIES = [
	{ id: 'new', name: 'New', icon: <Target className="w-4 h-4" /> },
	{ id: 'trending', name: 'Trending', icon: <TrendingUp className="w-4 h-4" /> },
	{ id: 'popular', name: 'Popular', icon: <Flame className="w-4 h-4" /> },
	{ id: 'liquid', name: 'Liquid', icon: <DollarSign className="w-4 h-4" /> },
	{ id: 'ending-soon', name: 'Ending Soon', icon: <Clock className="w-4 h-4" /> },
	{ id: 'competitive', name: 'Competitive', icon: <Activity className="w-4 h-4" /> },
];

export default function SearchModal({ onClose }: { onClose: () => void }) {
	const navigate = useNavigate();
	const [query, setQuery] = useState('');
	const [results, setResults] = useState<any[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const dragControls = useDragControls();

	const debouncedQuery = useDebounce(query, 300);

	useEffect(() => {
		// Auto-focus input on mount
		if (inputRef.current) {
			inputRef.current.focus();
		}
	}, []);

	useEffect(() => {
		if (debouncedQuery.trim().length > 0) {
			fetchResults(debouncedQuery);
		} else {
			setResults([]);
		}
	}, [debouncedQuery]);

	const fetchResults = async (q: string) => {
		setIsLoading(true);
		try {
			const res = await axios.get(`http://localhost:3000/api/v1/market/search?q=${q}&limit=6`, {
				withCredentials: true,
			});
			if (res.data?.success) {
				setResults(res.data.data);
			}
		} catch (error) {
			console.error('Search failed', error);
		} finally {
			setIsLoading(false);
		}
	};

	const handleNavigate = (path: string) => {
		onClose();
		navigate(path);
	};

	return (
		<div
			className="fixed inset-0 z-100 flex flex-col justify-end bg-black/40 backdrop-blur-sm md:hidden"
			onClick={onClose}
		>
			<motion.div
				initial={{ y: '100%' }}
				animate={{ y: 0 }}
				exit={{ y: '100%' }}
				transition={{ type: 'spring', damping: 25, stiffness: 300 }}
				drag="y"
				dragControls={dragControls}
				dragListener={false}
				dragConstraints={{ top: 0 }}
				dragElastic={0.2}
				onDragEnd={(_, { offset, velocity }) => {
					if (offset.y > 100 || velocity.y > 500) {
						onClose();
					}
				}}
				className="w-full h-[85vh] bg-card rounded-t-3xl shadow-xl flex flex-col overflow-hidden"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Mobile Drag Handle */}
				<div
					className="w-full flex justify-center py-4 cursor-grab active:cursor-grabbing z-20 touch-none shrink-0 bg-card rounded-t-3xl"
					onPointerDown={(e) => dragControls.start(e)}
				>
					<div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
				</div>

				<div className="px-4 py-2 border-b border-border flex items-center gap-3 bg-card">
					<div className="relative flex-1">
						<Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
						<input
							ref={inputRef}
							type="text"
							placeholder="Search markets..."
							className="w-full bg-gray-100 dark:bg-[#2C2C2E] text-gray-900 dark:text-white rounded-xl pl-10 pr-10 py-3 text-[15px] focus:outline-none transition-all placeholder:text-gray-500"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
						/>
						{query && (
							<button
								onClick={() => setQuery('')}
								className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full text-gray-500 transition-colors"
							>
								<X className="w-4 h-4" />
							</button>
						)}
					</div>
				</div>

				<div className="flex-1 overflow-y-auto px-4 py-4 bg-card">
					{query.trim().length > 0 ? (
						<div className="flex flex-col gap-1">
							{isLoading ? (
								<div className="flex justify-center py-8">
									<div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
								</div>
							) : results.length > 0 ? (
								results.map((market) => (
									<div
										key={market.id}
										onClick={() => handleNavigate(`/events/${market.id}`)}
										className="flex items-center gap-3 p-3 hover:bg-gray-200 dark:hover:bg-muted rounded-lg cursor-pointer transition-colors"
									>
										<img
											src={market.image_url}
											alt={market.title}
											className="w-10 h-10 rounded-md object-cover shrink-0"
										/>
										<div className="flex-1 min-w-0">
											<p className="text-sm font-medium text-foreground truncate">{market.title}</p>
											<div className="flex items-center gap-2 mt-1">
												<span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded">
													{Math.round((market.yes_price || 0) * 100)}%
												</span>
												<span className="text-xs text-gray-500 truncate">
													Vol: ₹{(market.volume || 0).toLocaleString()}
												</span>
											</div>
										</div>
									</div>
								))
							) : (
								<div className="text-center py-8 text-gray-500 dark:text-gray-400">
									<p className="text-sm">No markets found for "{query}"</p>
								</div>
							)}
						</div>
					) : (
						<div className="flex flex-col gap-6">
							<div>
								<h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">
									Browse Categories
								</h3>
								<div className="flex flex-wrap gap-2">
									{BROWSE_CATEGORIES.map((category) => (
										<button
											key={category.id}
											onClick={() => handleNavigate(`/category/${category.id}`)}
											className="flex items-center gap-2 px-3 py-1.5 text-sm bg-background border border-border hover:bg-gray-200 dark:hover:bg-muted rounded-full text-foreground cursor-pointer transition-colors"
										>
											{category.icon}
											<span>{category.name}</span>
										</button>
									))}
								</div>
							</div>
						</div>
					)}
				</div>
			</motion.div>
		</div>
	);
}
