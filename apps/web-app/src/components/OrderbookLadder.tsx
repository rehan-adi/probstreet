import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Order {
	price: number;
	quantity: number;
}

interface OrderbookLadderProps {
	bids: Order[];
	asks: Order[];
	onPriceSelect: (price: number, qty: number) => void;
	isLocked?: boolean;
	onToggleLock?: () => void;
	tradersCount?: number;
	resetScrollToken?: number;
}

const OrderRow = React.memo(
	({
		type,
		order,
		cumulative,
		maxCum,
		isHovered: _isHovered,
		isHighlighted,
		isBoundary,
		onHover,
		onLeave,
		onClick,
	}: {
		type: 'ask' | 'bid';
		order: Order;
		cumulative: number;
		maxCum: number;
		isHovered: boolean;
		isHighlighted: boolean;
		isBoundary: boolean;
		onHover: () => void;
		onLeave: () => void;
		onClick: () => void;
	}) => {
		const [flash, setFlash] = useState<'increase' | 'decrease' | null>(null);
		const prevQty = useRef(order.quantity);

		useEffect(() => {
			if (prevQty.current !== order.quantity) {
				setFlash(order.quantity > prevQty.current ? 'increase' : 'decrease');
				prevQty.current = order.quantity;
				const timer = setTimeout(() => setFlash(null), 300);
				return () => clearTimeout(timer);
			}
		}, [order.quantity]);

		const depthPercent = maxCum > 0 ? (cumulative / maxCum) * 100 : 0;
		const isAsk = type === 'ask';

		const textColor = isAsk ? 'text-red-500' : 'text-green-500';
		const flashBg =
			flash === 'increase'
				? 'bg-green-500/20'
				: flash === 'decrease'
					? 'bg-red-500/20'
					: 'bg-transparent';

		// Boundary borders
		const borderClass = isBoundary
			? isAsk
				? 'border-t border-dashed border-red-500/50'
				: 'border-b border-dashed border-green-500/50'
			: 'border-t border-b border-transparent';

		const highlightBg = isHighlighted ? 'bg-zinc-200/80 dark:bg-zinc-800' : 'bg-transparent';

		const highlightDepth = isHighlighted
			? isAsk
				? 'from-rose-500/40 to-rose-500/10'
				: 'from-emerald-500/40 to-emerald-500/10'
			: isAsk
				? 'from-rose-500/20 to-rose-500/5'
				: 'from-emerald-500/20 to-emerald-500/5';

		return (
			<motion.div
				layout="position"
				initial={{ opacity: 0, x: isAsk ? 10 : -10 }}
				animate={{ opacity: 1, x: 0 }}
				exit={{ opacity: 0, scale: 0.95 }}
				transition={{ duration: 0.2 }}
				onMouseEnter={onHover}
				onMouseLeave={onLeave}
				onClick={onClick}
				className={`relative grid grid-cols-3 items-center h-[30px] px-4 cursor-pointer tabular-nums text-sm transition-colors duration-150 ${flashBg} ${highlightBg} ${borderClass} z-10 hover:z-20 ${!isHighlighted ? 'hover:bg-muted/50' : ''}`}
			>
				{/* Cumulative Depth Bar */}
				<div
					className={`absolute top-0 bottom-0 right-0 origin-right transition-transform duration-300 ease-out bg-gradient-to-l ${highlightDepth} -z-10`}
					style={{ transform: `scaleX(${depthPercent / 100})`, width: '100%' }}
				/>

				<span className={`font-bold transition-all ${textColor}`}>{order.price.toFixed(1)}</span>
				<span
					className={`text-center font-semibold tracking-tight transition-colors ${isHighlighted ? 'text-foreground' : 'text-muted-foreground'}`}
				>
					{order.quantity}
				</span>
				<span
					className={`text-right font-medium tracking-tight transition-colors ${isHighlighted ? 'text-foreground' : 'text-muted-foreground'}`}
				>
					{cumulative}
				</span>
			</motion.div>
		);
	},
);

export default function OrderbookLadder({
	bids,
	asks,
	onPriceSelect,
	isLocked,
	resetScrollToken,
}: OrderbookLadderProps) {
	const [hoveredAskIndex, setHoveredAskIndex] = useState<number | null>(null);
	const [hoveredBidIndex, setHoveredBidIndex] = useState<number | null>(null);
	const scrollRef = useRef<HTMLDivElement>(null);

	const askScrollRef = useRef<HTMLDivElement>(null);
	const bidScrollRef = useRef<HTMLDivElement>(null);

	// ROW_HEIGHT must match the h-[30px] on OrderRow
	const ROW_HEIGHT = 30;
	const VISIBLE_ROWS = 7;

	// Scroll ask section to bottom (so best asks are visible near spread)
	const scrollAsksToBottom = (smooth = false) => {
		if (askScrollRef.current) {
			askScrollRef.current.scrollTo({
				top: askScrollRef.current.scrollHeight,
				behavior: smooth ? 'smooth' : 'auto',
			});
		}
	};

	// Scroll bid section to top (so best bids are visible near spread)
	const scrollBidsToTop = (smooth = false) => {
		if (bidScrollRef.current) {
			bidScrollRef.current.scrollTo({
				top: 0,
				behavior: smooth ? 'smooth' : 'auto',
			});
		}
	};

	// Initial center on load — scroll asks to bottom, bids to top
	const [hasInitialScrolled, setHasInitialScrolled] = useState(false);
	useEffect(() => {
		if (!hasInitialScrolled && (bids.length > 0 || asks.length > 0)) {
			const timer = setTimeout(() => {
				scrollAsksToBottom();
				scrollBidsToTop();
				setHasInitialScrolled(true);
			}, 50);
			return () => clearTimeout(timer);
		}
	}, [bids, asks, hasInitialScrolled]);

	// Explicit re-centre from header button
	useEffect(() => {
		if (resetScrollToken !== undefined && resetScrollToken > 0) {
			scrollAsksToBottom(true);
			scrollBidsToTop(true);
		}
	}, [resetScrollToken]);

	// Process Asks
	const processedAsks = React.useMemo(() => {
		const sorted = [...asks]
			.filter((o) => o.price > 0 && o.quantity > 0)
			.slice(0, 15) // Top 15 best asks
			.reverse(); // Reverse so highest is at top, best ask at bottom

		let cum = 0;
		const withCum = new Array(sorted.length);
		for (let i = sorted.length - 1; i >= 0; i--) {
			cum += sorted[i].quantity;
			withCum[i] = { ...sorted[i], cumulative: cum };
		}
		return withCum;
	}, [asks]);

	// Process Bids
	const processedBids = React.useMemo(() => {
		const sorted = [...bids].filter((o) => o.price > 0 && o.quantity > 0).slice(0, 15); // Top 15 best bids

		let cum = 0;
		const withCum = new Array(sorted.length);
		for (let i = 0; i < sorted.length; i++) {
			cum += sorted[i].quantity;
			withCum[i] = { ...sorted[i], cumulative: cum };
		}
		return withCum;
	}, [bids]);

	const maxCum = Math.max(
		processedAsks[0]?.cumulative || 0,
		processedBids[processedBids.length - 1]?.cumulative || 0,
	);

	const spread =
		processedAsks.length > 0 && processedBids.length > 0
			? (processedAsks[processedAsks.length - 1].price - processedBids[0].price).toFixed(1)
			: null;

	return (
		<div className="text-sm w-full font-mono h-full flex flex-col">
			<div className="grid grid-cols-3 pb-3 text-muted-foreground text-[11px] uppercase tracking-wider font-bold border-b border-border mb-2 px-4 shrink-0">
				<span>PRICE (₹)</span>
				<span className="text-center">SHARES</span>
				<span className="text-right">TOTAL</span>
			</div>
			<div
				ref={scrollRef}
				className="flex flex-col flex-1 min-h-0"
				onMouseLeave={() => {
					setHoveredAskIndex(null);
					setHoveredBidIndex(null);
				}}
			>
				{/* Asks Section */}
				<div className="flex flex-col justify-end relative flex-1">
					{processedAsks.length === 0 ? (
						<div
							className="flex items-center justify-center text-xs text-muted-foreground opacity-50"
							style={{ height: VISIBLE_ROWS * ROW_HEIGHT }}
						>
							No asks available
						</div>
					) : (
						<div
							ref={askScrollRef}
							className={`${isLocked ? 'overflow-hidden' : 'overflow-y-auto'} scrollbar-hide`}
							style={{ maxHeight: VISIBLE_ROWS * ROW_HEIGHT }}
						>
							<AnimatePresence initial={false}>
								{processedAsks.map((ask, idx) => {
									const isHighlighted = hoveredAskIndex !== null && idx >= hoveredAskIndex;
									const isHovered = hoveredAskIndex === idx;
									const isBoundary = hoveredAskIndex === idx;

									return (
										<OrderRow
											key={`ask-${ask.price}`}
											type="ask"
											order={ask}
											cumulative={ask.cumulative}
											maxCum={maxCum}
											isHovered={isHovered}
											isHighlighted={isHighlighted}
											isBoundary={isBoundary}
											onHover={() => setHoveredAskIndex(idx)}
											onLeave={() => setHoveredAskIndex(null)}
											onClick={() => onPriceSelect(ask.price, ask.cumulative)}
										/>
									);
								})}
							</AnimatePresence>
						</div>
					)}
					<div className="text-[10px] text-red-500/70 font-bold uppercase tracking-widest px-4 py-1.5 bg-card/50">
						ASKS
					</div>
				</div>

				{/* Spread / Mid Market */}
				<div className="spread-row flex items-center justify-between py-2.5 bg-card/95 backdrop-blur-sm border-y border-border/50 shadow-[0_0_10px_rgba(0,0,0,0.05)] px-4 shrink-0">
					<span className="text-[11px] font-bold text-muted-foreground tracking-widest uppercase">
						SPREAD
					</span>
					<span className="text-xs font-bold text-foreground">{spread ? `₹${spread}` : '-'}</span>
				</div>

				{/* Bids Section */}
				<div className="flex flex-col justify-start relative flex-1">
					<div className="text-[10px] text-green-500/70 font-bold uppercase tracking-widest px-4 py-1.5 bg-card/50">
						BIDS
					</div>
					{processedBids.length === 0 ? (
						<div
							className="flex items-center justify-center text-xs text-muted-foreground opacity-50"
							style={{ height: VISIBLE_ROWS * ROW_HEIGHT }}
						>
							No bids available
						</div>
					) : (
						<div
							ref={bidScrollRef}
							className={`${isLocked ? 'overflow-hidden' : 'overflow-y-auto'} scrollbar-hide`}
							style={{ maxHeight: VISIBLE_ROWS * ROW_HEIGHT }}
						>
							<AnimatePresence initial={false}>
								{processedBids.map((bid, idx) => {
									const isHighlighted = hoveredBidIndex !== null && idx <= hoveredBidIndex;
									const isHovered = hoveredBidIndex === idx;
									const isBoundary = hoveredBidIndex === idx;

									return (
										<OrderRow
											key={`bid-${bid.price}`}
											type="bid"
											order={bid}
											cumulative={bid.cumulative}
											maxCum={maxCum}
											isHovered={isHovered}
											isHighlighted={isHighlighted}
											isBoundary={isBoundary}
											onHover={() => setHoveredBidIndex(idx)}
											onLeave={() => setHoveredBidIndex(null)}
											onClick={() => onPriceSelect(bid.price, bid.cumulative)}
										/>
									);
								})}
							</AnimatePresence>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
