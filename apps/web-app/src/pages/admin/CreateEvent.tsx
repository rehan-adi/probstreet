import api from '@/config/axios';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllCategoary } from '@/api/category';
import { Calendar } from '@/components/ui/calendar';
import { useCreateEventMutation } from '@/hooks/mutations/event';
import {
	CalendarIcon,
	UploadCloud,
	ArrowLeft,
	Sparkles,
	Coins,
	UserCheck,
	Code2,
	Loader2,
	Trophy,
	Search,
	ChevronRight,
} from 'lucide-react';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const steps = ['Basic Info', 'Timeline & Resolution', 'Thumbnail'];

const SUPPORTED_CRYPTO = [
	{ id: 'bitcoin', name: 'Bitcoin (BTC)' },
	{ id: 'ethereum', name: 'Ethereum (ETH)' },
	{ id: 'solana', name: 'Solana (SOL)' },
	{ id: 'ripple', name: 'XRP (Ripple)' },
	{ id: 'dogecoin', name: 'Dogecoin (DOGE)' },
	{ id: 'binancecoin', name: 'BNB (Binance Coin)' },
	{ id: 'cardano', name: 'Cardano (ADA)' },
];

const CreateEvent = () => {
	const [step, setStep] = useState(0);
	const [form, setForm] = useState({
		title: '',
		eos: '',
		rules: '',
		endTime: '',
		categoryId: '',
		thumbnail: null as File | null,
	});

	const [resolutionType, setResolutionType] = useState<
		'MANUAL' | 'CRYPTO_PRICE' | 'AI_SEARCH' | 'CUSTOM_API' | 'SPORTS_MATCH'
	>('MANUAL');

	// Crypto Price Resolver state
	const [cryptoAsset, setCryptoAsset] = useState('bitcoin');
	const [cryptoCondition, setCryptoCondition] = useState<'gt' | 'lt'>('gt');
	const [cryptoTargetPrice, setCryptoTargetPrice] = useState('');
	const [cryptoMarketType, setCryptoMarketType] = useState<'TOUCH' | 'DIRECTION'>('TOUCH');

	// Custom API state
	const [customApiUrl, setCustomApiUrl] = useState('');
	const [customApiMode, setCustomApiMode] = useState<'ai' | 'json_path'>('ai');
	const [customJsonPath, setCustomJsonPath] = useState('');
	const [customCondition, setCustomCondition] = useState<'gt' | 'lt' | 'eq'>('gt');
	const [customTargetValue, setCustomTargetValue] = useState('');

	// Sports Match state
	const [sportsDateFrom, setSportsDateFrom] = useState(() => {
		const d = new Date();
		return d.toISOString().split('T')[0];
	});
	const [sportsDateTo, setSportsDateTo] = useState(() => {
		const d = new Date();
		d.setDate(d.getDate() + 7);
		return d.toISOString().split('T')[0];
	});
	const [sportsFixtures, setSportsFixtures] = useState<any[]>([]);
	const [isSearchingSports, setIsSearchingSports] = useState(false);
	const [selectedSportsFixture, setSelectedSportsFixture] = useState<any>(null);
	const [sportsCondition, setSportsCondition] = useState<'home_win' | 'away_win' | 'draw'>(
		'home_win',
	);

	const [categories, setCategories] = useState<{ id: string; categoryName: string }[]>([]);

	useEffect(() => {
		const fetchCategories = async () => {
			try {
				const response = await getAllCategoary();
				if (response.data?.success && response.data?.data) {
					setCategories(response.data.data);
				}
			} catch (err) {
				console.error('Error fetching categories:', err);
			}
		};
		fetchCategories();
	}, []);

	const searchSportsFixtures = async () => {
		if (!sportsDateFrom || !sportsDateTo) return;
		setIsSearchingSports(true);
		try {
			const res = await api.get(
				`/aapi/sports/fixtures?dateFrom=${sportsDateFrom}&dateTo=${sportsDateTo}`,
			);
			if (res.data?.success) {
				setSportsFixtures(res.data.data);
			}
		} catch (err) {
			console.error('Failed to fetch sports fixtures', err);
		} finally {
			setIsSearchingSports(false);
		}
	};

	const handleChange = (e: any) => {
		const { name, value, files } = e.target;
		if (name === 'thumbnail') {
			setForm({ ...form, thumbnail: files[0] });
		} else {
			setForm({ ...form, [name]: value });
		}
	};

	const uploadToS3 = async (file: File): Promise<string> => {
		try {
			const res = await api.post('/market/generate-url', {
				fileName: file.name,
				fileType: file.type,
			});
			const { url, publicUrl } = res.data;
			const uploadRes = await fetch(url, {
				method: 'PUT',
				body: file,
				headers: { 'Content-Type': file.type },
			});
			if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);
			return publicUrl;
		} catch (err) {
			console.error('Upload to S3 failed:', err);
			throw err;
		}
	};

	const navigate = useNavigate();
	const { mutate: createEvent, isPending } = useCreateEventMutation();

	const handleSubmit = async () => {
		try {
			let uploadedKey = null;
			if (form.thumbnail) {
				uploadedKey = await uploadToS3(form.thumbnail);
			}

			let resolutionMode: 'MANUAL' | 'AUTOMATIC' = 'MANUAL';
			let sourceOfTruth = '';
			let oracleConfig: Record<string, any> | undefined = undefined;
			let selectedCryptoMarketType: 'TOUCH' | 'DIRECTION' | undefined = undefined;

			if (resolutionType === 'CRYPTO_PRICE') {
				resolutionMode = 'AUTOMATIC';
				sourceOfTruth = `https://api.binance.com/api/v3/ticker/price?symbol=${cryptoAsset}USDT`;
				oracleConfig = {
					resolver: 'crypto_price',
					resultPath: `${cryptoAsset}.usd`, // legacy field, not really used in our new crons since we use binance direct
					condition: cryptoCondition,
					targetValue: Number(cryptoTargetPrice),
				};
				selectedCryptoMarketType = cryptoMarketType;
			} else if (resolutionType === 'AI_SEARCH') {
				resolutionMode = 'AUTOMATIC';
				sourceOfTruth = '';
				oracleConfig = undefined;
			} else if (resolutionType === 'CUSTOM_API') {
				resolutionMode = 'AUTOMATIC';
				sourceOfTruth = customApiUrl;
				if (customApiMode === 'json_path') {
					oracleConfig = {
						resolver: 'json_compare',
						resultPath: customJsonPath,
						condition: customCondition,
						targetValue: isNaN(Number(customTargetValue))
							? customTargetValue
							: Number(customTargetValue),
					};
				}
			} else if (resolutionType === 'SPORTS_MATCH' && selectedSportsFixture) {
				resolutionMode = 'AUTOMATIC';
				sourceOfTruth = `https://api.football-data.org/v4/matches/${selectedSportsFixture.id}`;
				oracleConfig = {
					resolver: 'sports_match',
					statusPath: 'status',
					finishedStatus: 'FINISHED',
					homePath: 'score.fullTime.home',
					awayPath: 'score.fullTime.away',
					condition: sportsCondition,
					scheduledStartTime: selectedSportsFixture.utcDate,
				};
			}

			createEvent(
				{
					title: form.title,
					eos: form.eos,
					rules: form.rules,
					endTime: form.endTime,
					sourceOfTruth,
					resolutionMode,
					oracleConfig,
					cryptoMarketType: selectedCryptoMarketType,
					categoryId: form.categoryId,
					thumbnail: uploadedKey,
				},
				{
					onSuccess: () => navigate('/dashboard/markets'),
					onError: (error) => console.error('Create event error:', error),
				},
			);
		} catch (err) {
			console.error('Error submitting event:', err);
		}
	};

	const renderStep = () => {
		switch (step) {
			case 0:
				return (
					<div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
						<h3 className="text-xl font-bold tracking-tight text-foreground">Basic Information</h3>
						<div className="space-y-5">
							<div>
								<label className="block text-sm font-semibold mb-2 text-foreground">
									Title or Name of Event
								</label>
								<input
									type="text"
									name="title"
									placeholder="e.g. Will Bitcoin cross $100k?"
									value={form.title}
									onChange={handleChange}
									className="w-full p-3.5 bg-background border border-border text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition shadow-sm"
								/>
							</div>
							<div>
								<label className="block text-sm font-semibold mb-2 text-foreground">
									Event Overview & Statistics (EOS)
								</label>
								<textarea
									name="eos"
									rows={3}
									placeholder="Context, background details, and statistics for traders..."
									value={form.eos}
									onChange={handleChange}
									className="w-full p-3.5 bg-background border border-border text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition shadow-sm resize-none custom-scrollbar"
								/>
							</div>
							<div>
								<label className="block text-sm font-semibold mb-2 text-foreground">
									Event Rules
								</label>
								<textarea
									name="rules"
									rows={3}
									placeholder="Exact criteria for YES vs NO resolution..."
									value={form.rules}
									onChange={handleChange}
									className="w-full p-3.5 bg-background border border-border text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition shadow-sm resize-none custom-scrollbar"
								/>
							</div>
							<div>
								<label className="block text-sm font-semibold mb-2 text-foreground">Category</label>
								<Select
									value={form.categoryId}
									onValueChange={(value) => setForm({ ...form, categoryId: value })}
								>
									<SelectTrigger className="w-full p-3.5 bg-background border-border text-foreground rounded-xl h-auto shadow-sm focus:ring-2 focus:ring-primary/20">
										<SelectValue placeholder="Select Category" />
									</SelectTrigger>
									<SelectContent className="bg-popover border-border rounded-xl">
										{categories.map((category: any) => (
											<SelectItem
												key={category.id}
												value={category.id}
												className="cursor-pointer rounded-lg"
											>
												{category.categoryName}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
					</div>
				);
			case 1:
				return (
					<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
						<h3 className="text-xl font-bold tracking-tight text-foreground">
							Timeline & Resolution
						</h3>
						<div className="space-y-6">
							<div>
								<label className="block text-sm font-semibold mb-2 text-foreground">
									End Time (Market Closes)
								</label>
								<Popover>
									<PopoverTrigger asChild>
										<button
											type="button"
											className={cn(
												'w-full p-3.5 bg-background border border-border text-left rounded-xl flex justify-between items-center transition shadow-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/20',
												!form.endTime ? 'text-muted-foreground' : 'text-foreground',
											)}
										>
											{form.endTime
												? format(new Date(form.endTime), 'PPPp')
												: 'Pick end date and time'}
											<CalendarIcon className="h-4 w-4 opacity-50" />
										</button>
									</PopoverTrigger>
									<PopoverContent className="w-auto p-4 space-y-4 bg-popover border-border rounded-2xl shadow-xl">
										<Calendar
											mode="single"
											selected={form.endTime ? new Date(form.endTime) : undefined}
											onSelect={(date) => {
												if (!date) return;
												const existingTime = form.endTime ? new Date(form.endTime) : new Date();
												date.setHours(existingTime.getHours(), existingTime.getMinutes());
												setForm({ ...form, endTime: date.toISOString() });
											}}
											initialFocus
											showOutsideDays
										/>
										<input
											type="time"
											className="border border-border bg-background text-foreground rounded-lg p-2.5 w-full focus:outline-none focus:ring-2 focus:ring-primary/20 transition shadow-sm"
											value={form.endTime ? format(new Date(form.endTime), 'HH:mm') : ''}
											onChange={(e) => {
												const [hours, minutes] = e.target.value.split(':').map(Number);
												const date = form.endTime ? new Date(form.endTime) : new Date();
												date.setHours(hours, minutes);
												setForm({ ...form, endTime: date.toISOString() });
											}}
										/>
									</PopoverContent>
								</Popover>
								<p className="text-xs text-muted-foreground mt-2">
									Market starts immediately upon creation. Trading halts when End Time is reached.
								</p>
							</div>

							<div className="pt-4 border-t border-border space-y-4">
								<label className="block text-sm font-semibold text-foreground">
									Resolution Method
								</label>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									{[
										{
											id: 'MANUAL',
											icon: UserCheck,
											label: 'Manual Admin',
											desc: 'Admin resolves manually',
											color: 'text-foreground',
										},
										{
											id: 'CRYPTO_PRICE',
											icon: Coins,
											label: 'Crypto Price',
											desc: 'Deterministic Binance API',
											color: 'text-amber-500',
										},
										{
											id: 'SPORTS_MATCH',
											icon: Trophy,
											label: 'Sports Match',
											desc: 'Football-Data.org Pipeline',
											color: 'text-emerald-500',
										},
										{
											id: 'AI_SEARCH',
											icon: Sparkles,
											label: 'AI Web Search',
											desc: 'Tavily + Groq evaluation',
											color: 'text-blue-500',
										},
										{
											id: 'CUSTOM_API',
											icon: Code2,
											label: 'Custom API',
											desc: 'Provide JSON endpoint',
											color: 'text-purple-500',
										},
									].map((opt) => (
										<button
											key={opt.id}
											type="button"
											onClick={() => setResolutionType(opt.id as any)}
											className={cn(
												'p-4 rounded-xl border text-left transition flex flex-col justify-between gap-2',
												resolutionType === opt.id
													? 'border-primary bg-primary/5'
													: 'border-border bg-background hover:bg-accent',
											)}
										>
											<div className="flex items-center gap-2.5">
												<opt.icon className={cn('w-5 h-5', opt.color)} />
												<span className="font-semibold text-sm text-foreground">{opt.label}</span>
											</div>
											<p className="text-xs text-muted-foreground">{opt.desc}</p>
										</button>
									))}
								</div>

								{/* Sports Match */}
								{resolutionType === 'SPORTS_MATCH' && (
									<div className="p-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-5 animate-in fade-in duration-300">
										<div className="flex items-center gap-2 text-emerald-500 font-semibold text-sm">
											<Trophy className="w-5 h-5" />
											<span>Football Match Configuration</span>
										</div>

										{!selectedSportsFixture ? (
											<div className="space-y-4">
												<div className="grid grid-cols-2 gap-3">
													<div>
														<label className="block text-xs font-semibold mb-1.5 text-foreground">
															Date From
														</label>
														<input
															type="date"
															value={sportsDateFrom}
															onChange={(e) => setSportsDateFrom(e.target.value)}
															className="w-full p-2.5 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 text-foreground"
														/>
													</div>
													<div>
														<label className="block text-xs font-semibold mb-1.5 text-foreground">
															Date To
														</label>
														<input
															type="date"
															value={sportsDateTo}
															onChange={(e) => setSportsDateTo(e.target.value)}
															className="w-full p-2.5 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 text-foreground"
														/>
													</div>
												</div>
												<button
													type="button"
													onClick={searchSportsFixtures}
													disabled={isSearchingSports}
													className="w-full p-3 bg-emerald-500/10 text-emerald-500 font-semibold rounded-lg hover:bg-emerald-500/20 transition flex items-center justify-center gap-2 text-sm"
												>
													{isSearchingSports ? (
														<Loader2 className="w-4 h-4 animate-spin" />
													) : (
														<Search className="w-4 h-4" />
													)}
													Search Fixtures
												</button>
												{sportsFixtures.length > 0 && (
													<div className="max-h-75 overflow-y-auto space-y-2 mt-4 custom-scrollbar">
														{sportsFixtures.map((fixture) => (
															<button
																key={fixture.id}
																onClick={() => setSelectedSportsFixture(fixture)}
																className="w-full p-3 bg-background border border-border hover:border-emerald-500/50 rounded-lg text-left transition flex justify-between items-center group"
															>
																<div>
																	<div className="font-semibold text-sm text-foreground">
																		{fixture.homeTeam.shortName || fixture.homeTeam.name} vs{' '}
																		{fixture.awayTeam.shortName || fixture.awayTeam.name}
																	</div>
																	<div className="text-xs text-muted-foreground mt-0.5">
																		{fixture.competition.name} •{' '}
																		{new Date(fixture.utcDate).toLocaleString()}
																	</div>
																</div>
																<ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-emerald-500" />
															</button>
														))}
													</div>
												)}
											</div>
										) : (
											<div className="space-y-4">
												<div className="p-4 bg-background border border-border rounded-lg flex items-center justify-between">
													<div>
														<div className="text-xs text-emerald-500 font-semibold mb-1">
															Selected Match
														</div>
														<div className="font-bold text-foreground text-sm">
															{selectedSportsFixture.homeTeam.name} vs{' '}
															{selectedSportsFixture.awayTeam.name}
														</div>
														<div className="text-xs text-muted-foreground mt-0.5">
															{new Date(selectedSportsFixture.utcDate).toLocaleString()}
														</div>
													</div>
													<button
														onClick={() => setSelectedSportsFixture(null)}
														className="text-xs text-muted-foreground hover:text-foreground underline"
													>
														Change
													</button>
												</div>
												<div>
													<label className="block text-xs font-semibold mb-1.5 text-foreground">
														Target Outcome (YES Resolution)
													</label>
													<Select
														value={sportsCondition}
														onValueChange={(v: any) => setSportsCondition(v)}
													>
														<SelectTrigger className="w-full bg-background border-border text-foreground rounded-lg h-11">
															<SelectValue />
														</SelectTrigger>
														<SelectContent className="bg-popover border-border">
															<SelectItem value="home_win">
																{selectedSportsFixture.homeTeam.name} Wins
															</SelectItem>
															<SelectItem value="away_win">
																{selectedSportsFixture.awayTeam.name} Wins
															</SelectItem>
															<SelectItem value="draw">Match is a Draw</SelectItem>
														</SelectContent>
													</Select>
												</div>
											</div>
										)}
									</div>
								)}

								{/* Crypto Price */}
								{resolutionType === 'CRYPTO_PRICE' && (
									<div className="p-5 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-4 animate-in fade-in duration-300">
										<div className="flex items-center gap-2 text-amber-500 font-semibold text-sm">
											<Coins className="w-5 h-5" />
											<span>Crypto Price Parameters</span>
										</div>
										<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
											<div>
												<label className="block text-xs font-semibold mb-1.5 text-foreground">
													Asset
												</label>
												<Select value={cryptoAsset} onValueChange={setCryptoAsset}>
													<SelectTrigger className="w-full bg-background border-border rounded-lg text-foreground">
														<SelectValue />
													</SelectTrigger>
													<SelectContent className="bg-popover border-border">
														{SUPPORTED_CRYPTO.map((c) => (
															<SelectItem key={c.id} value={c.id}>
																{c.name}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
											<div>
												<label className="block text-xs font-semibold mb-1.5 text-foreground">
													Market Type
												</label>
												<Select
													value={cryptoMarketType}
													onValueChange={(v: 'TOUCH' | 'DIRECTION') => setCryptoMarketType(v)}
												>
													<SelectTrigger className="w-full bg-background border-border rounded-lg text-foreground">
														<SelectValue />
													</SelectTrigger>
													<SelectContent className="bg-popover border-border">
														<SelectItem value="TOUCH">Touch (Hit Target)</SelectItem>
														<SelectItem value="DIRECTION">Direction (At Expiry)</SelectItem>
													</SelectContent>
												</Select>
											</div>
											<div>
												<label className="block text-xs font-semibold mb-1.5 text-foreground">
													Condition
												</label>
												<Select
													value={cryptoCondition}
													onValueChange={(v: 'gt' | 'lt') => setCryptoCondition(v)}
												>
													<SelectTrigger className="w-full bg-background border-border rounded-lg text-foreground">
														<SelectValue />
													</SelectTrigger>
													<SelectContent className="bg-popover border-border">
														<SelectItem value="gt">Price &gt; Target</SelectItem>
														<SelectItem value="lt">Price &lt; Target</SelectItem>
													</SelectContent>
												</Select>
											</div>
											<div>
												<label className="block text-xs font-semibold mb-1.5 text-foreground">
													Target Price ($)
												</label>
												<input
													type="number"
													placeholder="e.g. 100000"
													value={cryptoTargetPrice}
													onChange={(e) => setCryptoTargetPrice(e.target.value)}
													className="w-full p-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-foreground"
												/>
											</div>
										</div>
									</div>
								)}

								{/* AI Search */}
								{resolutionType === 'AI_SEARCH' && (
									<div className="p-5 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-3 animate-in fade-in duration-300">
										<div className="flex items-center gap-2 text-blue-500 font-semibold text-sm">
											<Sparkles className="w-5 h-5" />
											<span>Automated Web Search & AI Decision</span>
										</div>
										<p className="text-sm text-muted-foreground leading-relaxed">
											When the market ends, the system will use <strong>Tavily Search</strong> to
											research the event in real-time. <strong>Groq AI</strong> will score the
											results against your rules and auto-resolve the market if confidence is &ge;
											90%.
										</p>
									</div>
								)}

								{/* Custom API */}
								{resolutionType === 'CUSTOM_API' && (
									<div className="p-5 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-4 animate-in fade-in duration-300">
										<div>
											<label className="block text-xs font-semibold mb-1.5 text-foreground">
												Source of Truth API URL
											</label>
											<input
												type="url"
												placeholder="https://api.example.com/v1/data"
												value={customApiUrl}
												onChange={(e) => setCustomApiUrl(e.target.value)}
												className="w-full p-2.5 bg-background border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-purple-500/20"
											/>
										</div>
										<div className="flex gap-4">
											<label className="flex items-center gap-2 text-sm font-semibold cursor-pointer text-foreground">
												<input
													type="radio"
													name="apiMode"
													checked={customApiMode === 'ai'}
													onChange={() => setCustomApiMode('ai')}
													className="accent-purple-500"
												/>
												<span>AI parses this API</span>
											</label>
											<label className="flex items-center gap-2 text-sm font-semibold cursor-pointer text-foreground">
												<input
													type="radio"
													name="apiMode"
													checked={customApiMode === 'json_path'}
													onChange={() => setCustomApiMode('json_path')}
													className="accent-purple-500"
												/>
												<span>Exact JSONPath Math</span>
											</label>
										</div>
										{customApiMode === 'json_path' && (
											<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
												<div>
													<label className="block text-xs font-semibold mb-1 text-foreground">
														JSON Path
													</label>
													<input
														type="text"
														placeholder="e.g. data.match.winner"
														value={customJsonPath}
														onChange={(e) => setCustomJsonPath(e.target.value)}
														className="w-full p-2.5 bg-background border border-border rounded-lg text-sm text-foreground"
													/>
												</div>
												<div>
													<label className="block text-xs font-semibold mb-1 text-foreground">
														Condition
													</label>
													<Select
														value={customCondition}
														onValueChange={(v: 'gt' | 'lt' | 'eq') => setCustomCondition(v)}
													>
														<SelectTrigger className="w-full bg-background border-border rounded-lg h-10 text-foreground">
															<SelectValue />
														</SelectTrigger>
														<SelectContent className="bg-popover border-border">
															<SelectItem value="gt">Greater Than</SelectItem>
															<SelectItem value="lt">Less Than</SelectItem>
															<SelectItem value="eq">Equals</SelectItem>
														</SelectContent>
													</Select>
												</div>
												<div>
													<label className="block text-xs font-semibold mb-1 text-foreground">
														Target Value
													</label>
													<input
														type="text"
														placeholder="e.g. 50"
														value={customTargetValue}
														onChange={(e) => setCustomTargetValue(e.target.value)}
														className="w-full p-2.5 bg-background border border-border rounded-lg text-sm text-foreground"
													/>
												</div>
											</div>
										)}
									</div>
								)}
							</div>
						</div>
					</div>
				);
			case 2:
				return (
					<div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
						<h3 className="text-xl font-bold tracking-tight text-foreground">Thumbnail</h3>
						<label
							htmlFor="file-upload"
							className={cn(
								'cursor-pointer flex flex-col items-center justify-center w-full border-2 border-dashed p-12 rounded-2xl transition-all',
								form.thumbnail
									? 'border-primary bg-primary/5'
									: 'border-border bg-background hover:bg-accent',
							)}
						>
							<UploadCloud
								className={cn(
									'w-12 h-12 mb-4 transition-colors',
									form.thumbnail ? 'text-primary' : 'text-muted-foreground',
								)}
							/>
							<span
								className={cn(
									'font-semibold text-center',
									form.thumbnail ? 'text-foreground' : 'text-muted-foreground',
								)}
							>
								{form.thumbnail ? form.thumbnail.name : 'Click to upload thumbnail image'}
							</span>
							{!form.thumbnail && (
								<span className="text-sm text-muted-foreground mt-2">
									PNG, JPG or WEBP up to 5MB
								</span>
							)}
							<input
								id="file-upload"
								type="file"
								name="thumbnail"
								accept="image/*"
								onChange={handleChange}
								className="hidden"
							/>
						</label>
					</div>
				);
		}
	};

	return (
		<AdminLayout>
			<div className="space-y-8 max-w-4xl mx-auto py-6">
				<div className="flex items-center gap-4">
					<button
						type="button"
						onClick={() => navigate('/dashboard/markets')}
						className="p-2 rounded-full hover:bg-accent transition text-muted-foreground hover:text-foreground"
					>
						<ArrowLeft className="w-5 h-5" />
					</button>
					<div>
						<h2 className="text-3xl font-bold tracking-tight text-foreground">Create New Market</h2>
						<p className="text-muted-foreground mt-1 text-sm">
							Launch a new prediction event on the platform.
						</p>
					</div>
				</div>

				<div className="flex items-center gap-3 mb-8">
					{steps.map((s, i) => (
						<div key={i} className="flex flex-col flex-1 gap-2">
							<div
								className={cn(
									'h-1.5 flex-1 rounded-full transition-colors duration-500',
									step >= i ? 'bg-primary shadow-sm' : 'bg-muted',
								)}
							/>
							<span
								className={cn(
									'text-[10px] font-bold uppercase tracking-wider',
									step >= i ? 'text-foreground' : 'text-muted-foreground',
								)}
							>
								{s}
							</span>
						</div>
					))}
				</div>

				<Card className="bg-card border-border shadow-sm rounded-2xl overflow-hidden">
					<CardContent className="p-8">
						{renderStep()}
						<div className="flex justify-between items-center mt-10 pt-6 border-t border-border">
							{step > 0 ? (
								<button
									type="button"
									onClick={() => setStep(step - 1)}
									className="px-6 py-3 border border-border text-foreground font-semibold rounded-xl hover:bg-accent transition shadow-sm text-sm"
								>
									Back
								</button>
							) : (
								<div />
							)}
							{step < steps.length - 1 ? (
								<button
									type="button"
									onClick={() => setStep(step + 1)}
									disabled={
										(step === 0 && (!form.title || !form.categoryId)) ||
										(step === 1 && !form.endTime)
									}
									className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed text-sm"
								>
									Continue
								</button>
							) : (
								<button
									type="button"
									onClick={handleSubmit}
									disabled={isPending || !form.title || !form.endTime || !form.categoryId}
									className="px-8 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
								>
									{isPending && <Loader2 className="w-4 h-4 animate-spin" />}
									Create Market
								</button>
							)}
						</div>
					</CardContent>
				</Card>
			</div>
		</AdminLayout>
	);
};

export default CreateEvent;
