import { useState, useEffect } from 'react';
import axios from 'axios';

interface NewsItem {
	title: string;
	link: string;
	source: string;
	thumbnail?: string | { url: string };
}

interface MarketNewsProps {
	symbol?: string;
}

export default function MarketNews({ symbol }: MarketNewsProps) {
	const [newsList, setNewsList] = useState<NewsItem[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!symbol) return;

		const fetchNews = async () => {
			setLoading(true);
			try {
				const response = await axios.get(`http://localhost:3000/api/v1/capi/market/${symbol}/news`);
				if (response.data.success && response.data.data && response.data.data.length > 0) {
					setNewsList(response.data.data.slice(0, 3));
				} else {
					setNewsList([]);
				}
			} catch (error) {
				console.error('Error fetching news:', error);
				setNewsList([]);
			} finally {
				setLoading(false);
			}
		};

		fetchNews();
	}, [symbol]);

	if (loading) {
		return (
			<div className="hidden md:block w-full mt-6 bg-card border border-border rounded-xl p-5">
				<h3 className="text-base font-bold text-foreground mb-4 border-b border-border pb-2">
					Related News
				</h3>
				<div className="flex flex-col gap-4">
					{[1, 2, 3].map((i) => (
						<div key={i} className="flex flex-col gap-2 p-3">
							<div className="h-5 bg-muted/60 rounded-md w-full animate-pulse"></div>
							<div className="h-4 bg-muted/60 rounded-md w-32 animate-pulse"></div>
						</div>
					))}
				</div>
			</div>
		);
	}

	if (!loading && newsList.length === 0) {
		return null;
	}

	return (
		<div className="hidden md:block w-full mt-6 bg-card border border-border rounded-xl p-5">
			<h3 className="text-base font-bold text-foreground mb-4 border-b border-border pb-2">
				Related News
			</h3>

			<div className="flex flex-col gap-2">
				{newsList.map((news, idx) => (
					<a
						key={idx}
						href={news.link}
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-start gap-3 cursor-pointer rounded-xl hover:bg-muted p-3 transition-colors duration-200"
					>
						{news.thumbnail && (
							<img
								src={typeof news.thumbnail === 'string' ? news.thumbnail : (news.thumbnail as any)?.url}
								alt={news.title}
								className="w-14 h-14 object-cover rounded-lg shrink-0"
								loading="lazy"
							/>
						)}
						<div className="flex flex-col gap-1 min-w-0">
							<p className="text-[14px] font-medium text-foreground line-clamp-2 leading-snug">
								{news.title}
							</p>
							<div className="flex items-center text-xs text-muted-foreground mt-0.5">
								<span className="font-medium text-foreground/70">{news.source}</span>
							</div>
						</div>
					</a>
				))}
			</div>
		</div>
	);
}
