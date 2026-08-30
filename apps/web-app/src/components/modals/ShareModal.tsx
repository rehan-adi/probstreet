import { toast } from 'sonner';
import { useState } from 'react';
import defaultThumbnail from '@/assets/images/logo.avif';
import barChartIcon from '@/assets/images/Bar_Chart.avif';
import { X, Check, Link as LinkIcon, Share2 } from 'lucide-react';

interface ShareModalProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	url: string;
	yesPrice?: number;
	noPrice?: number;
	category?: string;
	volume?: number | string;
	traders?: number;
	thumbnail?: string;
}

export default function ShareModal({
	isOpen,
	onClose,
	title,
	url,
	yesPrice = 5.0,
	noPrice = 5.0,
	volume = 0,
	traders = 0,
	thumbnail,
}: ShareModalProps) {
	const [copiedLink, setCopiedLink] = useState(false);

	if (!isOpen) return null;

	const handleCopyLink = async () => {
		try {
			await navigator.clipboard.writeText(url);
			setCopiedLink(true);
			toast.success('Event link copied to clipboard!');
			setTimeout(() => setCopiedLink(false), 2500);
		} catch (err) {
			console.error('Failed to copy link', err);
			toast.error('Failed to copy link');
		}
	};

	const shareText = encodeURIComponent(
		`🔥 Check out this prediction market on ProbStreet:\n"${title}"\n\nTrade YES (₹${yesPrice}) or NO (₹${noPrice}) now 👇`,
	);
	const shareUrl = encodeURIComponent(url);

	const formattedVolume =
		typeof volume === 'number'
			? volume.toLocaleString('en-IN')
			: isNaN(Number(volume))
				? volume
				: Number(volume).toLocaleString('en-IN');

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
			onClick={onClose}
		>
			<div
				className="bg-gray-50 dark:bg-[#090C1A] w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 dark:border-white/5 overflow-hidden"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-between px-5 py-2">
					<h2 className="text-base font-medium text-gray-900 dark:text-white">Share Event</h2>
					<button
						onClick={onClose}
						className="p-1.5 rounded-full text-gray-700 dark:text-gray-500 cursor-pointer"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				<div className="px-5 py-3 mb-2 space-y-4">
					<div className="mb-6 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col gap-3">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
								<img src={barChartIcon} className="w-4 h-4" alt="traders" />
								<span className="text-xs">{traders || 0} traders</span>
							</div>
						</div>

						<div className="flex gap-3 mt-1 items-start">
							<img
								src={thumbnail || defaultThumbnail}
								alt={title}
								className="w-12 h-12 object-cover rounded-lg border border-gray-200 dark:border-gray-800 shrink-0"
							/>
							<h3 className="text-sm font-medium line-clamp-3 leading-snug text-gray-900 dark:text-white">
								{title}
							</h3>
						</div>

						<div className="flex gap-3 w-full my-3">
							<button className="text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 text-xs px-3 py-2.5 rounded-md w-full font-bold cursor-default">
								Yes ₹{yesPrice}
							</button>
							<button className="text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 text-xs px-3 py-2.5 rounded-md w-full font-bold cursor-default">
								No ₹{noPrice}
							</button>
						</div>

						{/* Volume */}
						<p className="text-xs text-gray-500 dark:text-gray-400">
							<span className="font-bold text-gray-900 dark:text-white">₹{formattedVolume}</span>{' '}
							Vol.
						</p>
					</div>

					{/* Action Buttons */}
					<div className="flex gap-3">
						<button
							onClick={handleCopyLink}
							className="flex items-center justify-center gap-2 flex-1 py-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/8 text-gray-900 dark:text-white font-semibold text-sm rounded-xl cursor-pointer"
						>
							{copiedLink ? (
								<>
									<Check className="w-4 h-4 text-green-600 dark:text-green-400" />
									Copied!
								</>
							) : (
								<>
									<LinkIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
									Copy Link
								</>
							)}
						</button>

						<a
							href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`}
							target="_blank"
							rel="noreferrer"
							className="flex items-center justify-center gap-2 flex-1 py-3 bg-[#1DA1F2] text-white font-semibold text-sm rounded-xl cursor-pointer"
						>
							<Share2 className="w-4 h-4" />
							Share on X
						</a>
					</div>
				</div>
			</div>
		</div>
	);
}
