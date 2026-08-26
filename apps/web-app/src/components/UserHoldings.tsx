import { useEffect, useState } from 'react';
import { api } from '@/lib/axios';
import { TrendingUp, TrendingDown, Package, Loader2, X } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { cancelOrder } from '@/api/order';
import { toast } from 'sonner';
import { socket } from '@/socket';

interface Position {
	yesQuantity: number;
	noQuantity: number;
	yesInvested: number;
	noInvested: number;
	yesLocked: number;
	noLocked: number;
	yesSellValue: number;
	noSellValue: number;
}

interface ActiveOrder {
	id: string;
	stockType: string;
	orderType: string;
	price: number;
	quantity: number;
	filledQuantity: number;
	status: string;
	createdAt: string;
}

interface UserHoldingsProps {
	marketId: string;
	yesPrice: number;
	noPrice: number;
}

export default function UserHoldings({ marketId, yesPrice, noPrice }: UserHoldingsProps) {
	const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
	const [position, setPosition] = useState<Position | null>(null);
	const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
	const [loading, setLoading] = useState(true);
	const [cancellingId, setCancellingId] = useState<string | null>(null);

	const fetchPosition = async () => {
		try {
			const res = await api.get(`/portfolio/position/${marketId}`);
			if (res.data?.success) {
				setPosition(res.data.data.position);
				setActiveOrders(res.data.data.activeOrders || []);
			}
		} catch {
			// silent fail
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (!isAuthenticated || !marketId) return;
		fetchPosition();

		const handlePortfolioUpdate = () => {
			fetchPosition();
		};

		socket.on('PORTFOLIO_UPDATE', handlePortfolioUpdate);

		return () => {
			socket.off('PORTFOLIO_UPDATE', handlePortfolioUpdate);
		};
	}, [isAuthenticated, marketId]);

	if (!isAuthenticated) return null;

	const hasYes = position && (position.yesQuantity > 0 || position.yesLocked > 0);
	const hasNo = position && (position.noQuantity > 0 || position.noLocked > 0);
	const hasPosition = hasYes || hasNo;
	const hasOrders = activeOrders.length > 0;

	if (loading) {
		return (
			<div className="mb-6 bg-card border border-border rounded-xl p-5 shadow-sm">
				<div className="flex items-center gap-2">
					<div className="w-4 h-4 bg-muted rounded animate-pulse" />
					<div className="w-32 h-4 bg-muted rounded animate-pulse" />
				</div>
				<div className="mt-4 space-y-3">
					<div className="h-16 bg-muted/50 rounded-lg animate-pulse" />
				</div>
			</div>
		);
	}

	if (!hasPosition && !hasOrders) return null;

	const handleCancel = async (orderId: string) => {
		setCancellingId(orderId);
		try {
			const res = await cancelOrder(orderId, marketId);
			if (res.data?.success) {
				toast.success('Order cancelled');
				fetchPosition();
			} else {
				toast.error(res.data?.error || 'Failed to cancel');
			}
		} catch {
			toast.error('Failed to cancel order');
		} finally {
			setCancellingId(null);
		}
	};

	const yesAvailable = position?.yesQuantity || 0;
	const noAvailable = position?.noQuantity || 0;
	const yesLocked = position?.yesLocked || 0;
	const noLocked = position?.noLocked || 0;
	const yesInvested = position?.yesInvested || 0;
	const noInvested = position?.noInvested || 0;

	const yesCurrentValue = yesAvailable * yesPrice;
	const noCurrentValue = noAvailable * noPrice;
	const yesPnL = yesCurrentValue - yesInvested;
	const noPnL = noCurrentValue - noInvested;

	return (
		<div className="mb-6 bg-card border border-border rounded-xl shadow-sm overflow-hidden">
			<div className="px-5 py-3.5 border-b border-border bg-muted/30">
				<div className="flex items-center gap-2">
					<Package size={14} className="text-muted-foreground" />
					<span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
						Your Holdings
					</span>
				</div>
			</div>

			{hasPosition && (
				<div className="p-4 space-y-3">
					{hasYes && (
						<div className="flex items-center justify-between p-3 bg-green-500/5 border border-green-500/10 rounded-lg">
							<div className="flex items-center gap-3">
								<div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
									<TrendingUp size={14} className="text-green-500" />
								</div>
								<div>
									<div className="text-sm font-bold text-foreground">YES</div>
									<div className="text-[11px] text-muted-foreground">
										{yesAvailable} shares{yesLocked > 0 ? ` · ${yesLocked} locked` : ''}
									</div>
								</div>
							</div>
							<div className="text-right">
								<div className="text-sm font-bold text-foreground">
									₹{yesCurrentValue.toFixed(1)}
								</div>
								<div
									className={`text-[11px] font-semibold ${yesPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}
								>
									{yesPnL >= 0 ? '+' : ''}₹{yesPnL.toFixed(1)}
								</div>
							</div>
						</div>
					)}

					{hasNo && (
						<div className="flex items-center justify-between p-3 bg-red-500/5 border border-red-500/10 rounded-lg">
							<div className="flex items-center gap-3">
								<div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
									<TrendingDown size={14} className="text-red-500" />
								</div>
								<div>
									<div className="text-sm font-bold text-foreground">NO</div>
									<div className="text-[11px] text-muted-foreground">
										{noAvailable} shares{noLocked > 0 ? ` · ${noLocked} locked` : ''}
									</div>
								</div>
							</div>
							<div className="text-right">
								<div className="text-sm font-bold text-foreground">
									₹{noCurrentValue.toFixed(1)}
								</div>
								<div
									className={`text-[11px] font-semibold ${noPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}
								>
									{noPnL >= 0 ? '+' : ''}₹{noPnL.toFixed(1)}
								</div>
							</div>
						</div>
					)}
				</div>
			)}

			{hasOrders && (
				<div className="border-t border-border">
					<div className="px-5 py-2.5 bg-muted/20">
						<span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
							Active Orders ({activeOrders.length})
						</span>
					</div>
					<div className="px-4 pb-3 space-y-2">
						{activeOrders.map((order) => (
							<div
								key={order.id}
								className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg text-xs"
							>
								<div className="flex items-center gap-2">
									<span
										className={`font-bold ${order.orderType === 'SELL' ? 'text-red-500' : 'text-green-500'}`}
									>
										{order.orderType}
									</span>
									<span
										className={`font-semibold ${order.stockType === 'YES' ? 'text-blue-500' : 'text-orange-500'}`}
									>
										{order.stockType}
									</span>
									<span className="text-muted-foreground">
										{order.quantity - order.filledQuantity} @ ₹{Number(order.price).toFixed(1)}
									</span>
								</div>
								<button
									onClick={() => handleCancel(order.id)}
									disabled={cancellingId === order.id}
									className="p-1 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
									title="Cancel order"
								>
									{cancellingId === order.id ? (
										<Loader2 size={12} className="animate-spin" />
									) : (
										<X size={12} />
									)}
								</button>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
