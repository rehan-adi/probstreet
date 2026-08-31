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
	Globe,
	UserCheck,
	Code2,
	Loader2,
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

	// Resolution configuration state
	const [resolutionType, setResolutionType] = useState<
		'MANUAL' | 'CRYPTO_PRICE' | 'AI_SEARCH' | 'CUSTOM_API'
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

	const [categories, setCategories] = useState<{ id: string; categoryName: string }[]>([]);

	useEffect(() => {
		const fetchCategories = async () => {
			try {
				const response = await getAllCategoary();
				const result = response.data;
				if (result.success && result.data) {
					setCategories(result.data);
				}
			} catch (err) {
				console.error('Error fetching categories:', err);
			}
		};

		fetchCategories();
	}, []);

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
				headers: {
					'Content-Type': file.type,
				},
			});

			if (!uploadRes.ok) {
				const text = await uploadRes.text();
				console.error('Upload failed:', uploadRes.status, text);
				throw new Error(`Upload failed: ${uploadRes.status}`);
			}

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
					resultPath: `${cryptoAsset}.usd`,
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
				} else {
					oracleConfig = undefined; // AI will parse the custom API
				}
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
					onSuccess: () => {
						navigate('/dashboard/markets');
					},
					onError: (error) => {
						console.error('Create event error:', error);
					},
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
						<h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
							Basic Information
						</h3>

						<div className="space-y-5">
							<div>
								<label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
									Title or Name of Event
								</label>
								<input
									type="text"
									name="title"
									placeholder="e.g. Will Bitcoin cross $100k?"
									value={form.title}
									onChange={handleChange}
									className="w-full p-3.5 border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121214] text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition shadow-sm"
								/>
							</div>

							<div>
								<label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
									Event Overview & Statistics (EOS)
								</label>
								<textarea
									name="eos"
									rows={3}
									placeholder="Context, background details, and statistics for traders..."
									value={form.eos}
									onChange={handleChange}
									className="w-full p-3.5 border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121214] text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition shadow-sm resize-none custom-scrollbar"
								/>
							</div>

							<div>
								<label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
									Event Rules
								</label>
								<textarea
									name="rules"
									rows={3}
									placeholder="Exact criteria for YES vs NO resolution..."
									value={form.rules}
									onChange={handleChange}
									className="w-full p-3.5 border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121214] text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition shadow-sm resize-none custom-scrollbar"
								/>
							</div>

							<div>
								<label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
									Category
								</label>
								<Select
									value={form.categoryId}
									onValueChange={(value) => setForm({ ...form, categoryId: value })}
								>
									<SelectTrigger className="w-full p-3.5 border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121214] text-gray-900 dark:text-white rounded-xl h-auto shadow-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors focus:ring-1 focus:ring-black dark:focus:ring-white">
										<SelectValue placeholder="Select Category" />
									</SelectTrigger>
									<SelectContent className="bg-white dark:bg-[#1C1C1E] border-gray-200 dark:border-white/10 rounded-xl shadow-xl">
										{categories.map((category: any) => (
											<SelectItem
												key={category.id}
												value={category.id}
												className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 focus:bg-gray-50 dark:focus:bg-white/5 rounded-lg mx-1 my-0.5"
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
						<h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
							Timeline & Resolution
						</h3>

						<div className="space-y-6">
							{/* End Time */}
							<div>
								<label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
									End Time (Market Closes & Resolves)
								</label>
								<Popover>
									<PopoverTrigger asChild>
										<button
											type="button"
											className={cn(
												'w-full p-3.5 border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121214] text-left rounded-xl flex justify-between items-center transition hover:bg-gray-50 dark:hover:bg-white/5 shadow-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white',
												!form.endTime ? 'text-gray-400' : 'text-gray-900 dark:text-white',
											)}
										>
											{form.endTime
												? format(new Date(form.endTime), 'PPPp')
												: 'Pick end date and time'}
											<CalendarIcon className="h-4 w-4 text-gray-400" />
										</button>
									</PopoverTrigger>
									<PopoverContent className="w-auto p-4 space-y-4 bg-white dark:bg-[#1C1C1E] border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl">
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
											className="border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#2C2C2E] text-gray-900 dark:text-white rounded-lg p-2.5 w-full focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition shadow-inner"
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
								<p className="text-xs text-gray-400 mt-1.5">
									Market starts immediately upon creation. Trading halts when End Time is reached.
								</p>
							</div>

							{/* Resolution Mode Selector */}
							<div className="pt-4 border-t border-gray-100 dark:border-white/5 space-y-4">
								<label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
									Resolution Method
								</label>

								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									{/* Manual */}
									<button
										type="button"
										onClick={() => setResolutionType('MANUAL')}
										className={cn(
											'p-4 rounded-xl border text-left transition flex flex-col justify-between gap-2',
											resolutionType === 'MANUAL'
												? 'border-black dark:border-white bg-gray-50 dark:bg-white/10'
												: 'border-gray-200 dark:border-white/10 bg-white dark:bg-[#121214] hover:bg-gray-50/50 dark:hover:bg-white/5',
										)}
									>
										<div className="flex items-center gap-2.5">
											<UserCheck className="w-5 h-5 text-gray-700 dark:text-gray-300" />
											<span className="font-semibold text-sm text-gray-900 dark:text-white">
												Manual Admin
											</span>
										</div>
										<p className="text-xs text-gray-500 dark:text-gray-400">
											Admin resolves the market manually from the dashboard.
										</p>
									</button>

									{/* Crypto Price */}
									<button
										type="button"
										onClick={() => setResolutionType('CRYPTO_PRICE')}
										className={cn(
											'p-4 rounded-xl border text-left transition flex flex-col justify-between gap-2',
											resolutionType === 'CRYPTO_PRICE'
												? 'border-black dark:border-white bg-gray-50 dark:bg-white/10'
												: 'border-gray-200 dark:border-white/10 bg-white dark:bg-[#121214] hover:bg-gray-50/50 dark:hover:bg-white/5',
										)}
									>
										<div className="flex items-center gap-2.5">
											<Coins className="w-5 h-5 text-amber-500" />
											<span className="font-semibold text-sm text-gray-900 dark:text-white">
												Crypto Price (CoinGecko)
											</span>
										</div>
										<p className="text-xs text-gray-500 dark:text-gray-400">
											Instant, 100% free deterministic API math. No AI needed.
										</p>
									</button>

									{/* AI Web Search */}
									<button
										type="button"
										onClick={() => setResolutionType('AI_SEARCH')}
										className={cn(
											'p-4 rounded-xl border text-left transition flex flex-col justify-between gap-2',
											resolutionType === 'AI_SEARCH'
												? 'border-black dark:border-white bg-gray-50 dark:bg-white/10'
												: 'border-gray-200 dark:border-white/10 bg-white dark:bg-[#121214] hover:bg-gray-50/50 dark:hover:bg-white/5',
										)}
									>
										<div className="flex items-center gap-2.5">
											<Globe className="w-5 h-5 text-blue-500" />
											<span className="font-semibold text-sm text-gray-900 dark:text-white">
												AI Web Search
											</span>
										</div>
										<p className="text-xs text-gray-500 dark:text-gray-400">
											Tavily search + Groq AI evaluates live news against rules.
										</p>
									</button>

									{/* Custom API */}
									<button
										type="button"
										onClick={() => setResolutionType('CUSTOM_API')}
										className={cn(
											'p-4 rounded-xl border text-left transition flex flex-col justify-between gap-2',
											resolutionType === 'CUSTOM_API'
												? 'border-black dark:border-white bg-gray-50 dark:bg-white/10'
												: 'border-gray-200 dark:border-white/10 bg-white dark:bg-[#121214] hover:bg-gray-50/50 dark:hover:bg-white/5',
										)}
									>
										<div className="flex items-center gap-2.5">
											<Code2 className="w-5 h-5 text-emerald-500" />
											<span className="font-semibold text-sm text-gray-900 dark:text-white">
												Custom API Endpoint
											</span>
										</div>
										<p className="text-xs text-gray-500 dark:text-gray-400">
											Provide a sports or custom JSON API endpoint.
										</p>
									</button>
								</div>

								{/* Conditional Config Panels */}
								{resolutionType === 'CRYPTO_PRICE' && (
									<div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/30 bg-amber-50/40 dark:bg-amber-950/10 space-y-4 animate-in fade-in duration-300">
										<div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-sm">
											<Coins className="w-4 h-4" />
											<span>Crypto Price Parameters</span>
										</div>

										<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
											<div>
												<label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
													Asset
												</label>
												<Select value={cryptoAsset} onValueChange={setCryptoAsset}>
													<SelectTrigger className="w-full bg-white dark:bg-[#121214] border-gray-200 dark:border-white/10 rounded-lg">
														<SelectValue />
													</SelectTrigger>
													<SelectContent className="bg-white dark:bg-[#1C1C1E]">
														{SUPPORTED_CRYPTO.map((c) => (
															<SelectItem key={c.id} value={c.id}>
																{c.name}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>

											<div>
												<label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
													Market Type
												</label>
												<Select
													value={cryptoMarketType}
													onValueChange={(v: 'TOUCH' | 'DIRECTION') => setCryptoMarketType(v)}
												>
													<SelectTrigger className="w-full bg-white dark:bg-[#121214] border-gray-200 dark:border-white/10 rounded-lg">
														<SelectValue />
													</SelectTrigger>
													<SelectContent className="bg-white dark:bg-[#1C1C1E]">
														<SelectItem value="TOUCH">Touch (Hit Target)</SelectItem>
														<SelectItem value="DIRECTION">Direction (At Expiry)</SelectItem>
													</SelectContent>
												</Select>
											</div>

											<div>
												<label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
													Condition
												</label>
												<Select
													value={cryptoCondition}
													onValueChange={(v: 'gt' | 'lt') => setCryptoCondition(v)}
												>
													<SelectTrigger className="w-full bg-white dark:bg-[#121214] border-gray-200 dark:border-white/10 rounded-lg">
														<SelectValue />
													</SelectTrigger>
													<SelectContent className="bg-white dark:bg-[#1C1C1E]">
														<SelectItem value="gt">Price &gt; Target (Above)</SelectItem>
														<SelectItem value="lt">Price &lt; Target (Below)</SelectItem>
													</SelectContent>
												</Select>
											</div>

											<div>
												<label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
													Target Price ($ USD)
												</label>
												<input
													type="number"
													placeholder="e.g. 100000"
													value={cryptoTargetPrice}
													onChange={(e) => setCryptoTargetPrice(e.target.value)}
													className="w-full p-2.5 border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121214] rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none"
												/>
											</div>
										</div>
									</div>
								)}

								{resolutionType === 'AI_SEARCH' && (
									<div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/30 bg-blue-50/40 dark:bg-blue-950/10 space-y-2 animate-in fade-in duration-300">
										<div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-semibold text-sm">
											<Sparkles className="w-4 h-4" />
											<span>Automated Web Search & AI Decision</span>
										</div>
										<p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
											When the market ends, the system will use <strong>Tavily Search</strong> to
											research the event in real-time. <strong>Groq AI (120B)</strong> will score
											the results against your rules and auto-resolve the market if confidence is
											&ge; 90%.
										</p>
									</div>
								)}

								{resolutionType === 'CUSTOM_API' && (
									<div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/30 bg-emerald-50/40 dark:bg-emerald-950/10 space-y-4 animate-in fade-in duration-300">
										<div>
											<label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
												Source of Truth API URL
											</label>
											<input
												type="url"
												placeholder="https://api.football-data.org/v4/matches/123"
												value={customApiUrl}
												onChange={(e) => setCustomApiUrl(e.target.value)}
												className="w-full p-2.5 border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121214] rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none"
											/>
										</div>

										<div className="flex gap-4">
											<label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
												<input
													type="radio"
													name="apiMode"
													checked={customApiMode === 'ai'}
													onChange={() => setCustomApiMode('ai')}
												/>
												<span>AI parses this API</span>
											</label>
											<label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
												<input
													type="radio"
													name="apiMode"
													checked={customApiMode === 'json_path'}
													onChange={() => setCustomApiMode('json_path')}
												/>
												<span>Exact JSONPath Math</span>
											</label>
										</div>

										{customApiMode === 'json_path' && (
											<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
												<div>
													<label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
														JSON Path
													</label>
													<input
														type="text"
														placeholder="e.g. data.match.winner"
														value={customJsonPath}
														onChange={(e) => setCustomJsonPath(e.target.value)}
														className="w-full p-2 text-xs border rounded-lg bg-white dark:bg-[#121214]"
													/>
												</div>
												<div>
													<label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
														Condition
													</label>
													<Select
														value={customCondition}
														onValueChange={(v: 'gt' | 'lt' | 'eq') => setCustomCondition(v)}
													>
														<SelectTrigger className="w-full bg-white dark:bg-[#121214] text-xs h-9">
															<SelectValue />
														</SelectTrigger>
														<SelectContent className="bg-white dark:bg-[#1C1C1E]">
															<SelectItem value="gt">Greater Than (&gt;)</SelectItem>
															<SelectItem value="lt">Less Than (&lt;)</SelectItem>
															<SelectItem value="eq">Equals (==)</SelectItem>
														</SelectContent>
													</Select>
												</div>
												<div>
													<label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
														Target Value
													</label>
													<input
														type="text"
														placeholder="e.g. 50 or Arsenal"
														value={customTargetValue}
														onChange={(e) => setCustomTargetValue(e.target.value)}
														className="w-full p-2 text-xs border rounded-lg bg-white dark:bg-[#121214]"
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
						<h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
							Thumbnail
						</h3>

						<label
							htmlFor="file-upload"
							className={cn(
								'cursor-pointer flex flex-col items-center justify-center w-full border border-dashed p-12 rounded-2xl transition-all shadow-sm',
								form.thumbnail
									? 'border-gray-900 bg-gray-50 dark:border-white dark:bg-white/5'
									: 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#121214] hover:bg-gray-100 dark:hover:bg-[#1C1C1E]',
							)}
						>
							<UploadCloud
								className={cn(
									'w-12 h-12 mb-4 transition-colors',
									form.thumbnail ? 'text-gray-900 dark:text-white' : 'text-gray-400',
								)}
							/>
							<span
								className={cn(
									'font-semibold text-center',
									form.thumbnail
										? 'text-gray-900 dark:text-white'
										: 'text-gray-500 dark:text-gray-400',
								)}
							>
								{form.thumbnail ? form.thumbnail.name : 'Click to upload thumbnail image'}
							</span>
							{!form.thumbnail && (
								<span className="text-sm text-gray-400 mt-2">PNG, JPG or WEBP up to 5MB</span>
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
			<div className="space-y-8 max-w-3xl mx-auto py-6">
				<div className="flex items-center gap-4">
					<button
						type="button"
						onClick={() => navigate('/dashboard/markets')}
						className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
					>
						<ArrowLeft className="w-5 h-5" />
					</button>
					<div>
						<h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
							Create New Market
						</h2>
						<p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
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
									step >= i
										? 'bg-gray-900 dark:bg-white shadow-sm'
										: 'bg-gray-200 dark:bg-white/10',
								)}
							/>
							<span
								className={cn(
									'text-[10px] font-bold uppercase tracking-wider',
									step >= i ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600',
								)}
							>
								{s}
							</span>
						</div>
					))}
				</div>

				<Card className="bg-white dark:bg-[#1C1C1E] border-gray-200 dark:border-white/10 shadow-sm rounded-2xl overflow-hidden">
					<CardContent className="p-8">
						{renderStep()}

						<div className="flex justify-between items-center mt-10 pt-6 border-t border-gray-100 dark:border-white/5">
							{step > 0 ? (
								<button
									type="button"
									onClick={() => setStep(step - 1)}
									className="px-6 py-3 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition shadow-sm text-sm"
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
									className="px-6 py-3 bg-gray-900 text-white dark:bg-white dark:text-black font-semibold rounded-xl hover:opacity-90 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed text-sm"
								>
									Continue
								</button>
							) : (
								<button
									type="button"
									onClick={handleSubmit}
									disabled={isPending || !form.title || !form.endTime || !form.categoryId}
									className="px-8 py-3 bg-gray-900 text-white dark:bg-white dark:text-black font-semibold rounded-xl hover:opacity-90 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
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
