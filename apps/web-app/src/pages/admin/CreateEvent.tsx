import api from '@/config/axios';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllCategoary } from '@/api/category';
import { Calendar } from '@/components/ui/calendar';
import { useCreateEventMutation } from '@/hooks/mutations/event';
import { CalendarIcon, Loader2, UploadCloud, ArrowLeft } from 'lucide-react';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';

const steps = ['Basic Info', 'Timeline', 'Thumbnail'];

const CreateEvent = () => {
	const [step, setStep] = useState(0);
	const [form, setForm] = useState({
		title: '',
		eos: '',
		rules: '',
		startTime: '',
		endTime: '',
		sourceOfTruth: '',
		categoryId: '',
		thumbnail: null as File | null,
	});

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

			createEvent(
				{
					title: form.title,
					eos: form.eos,
					rules: form.rules,
					startTime: form.startTime,
					endTime: form.endTime,
					sourceOfTruth: form.sourceOfTruth,
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
									Event Overview & Statistics
								</label>
								<textarea
									name="eos"
									rows={3}
									placeholder="Brief overview of the event context..."
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
									placeholder="Resolution criteria and specific rules..."
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
											<SelectItem key={category.id} value={category.id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 focus:bg-gray-50 dark:focus:bg-white/5 rounded-lg mx-1 my-0.5">
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
					<div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
						<h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
							Timeline & Source
						</h3>

						<div className="space-y-5">
							<div>
								<label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
									Start Time
								</label>
								<Popover>
									<PopoverTrigger asChild>
										<button
											type="button"
											className={cn(
												'w-full p-3.5 border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121214] text-left rounded-xl flex justify-between items-center transition hover:bg-gray-50 dark:hover:bg-white/5 shadow-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white',
												!form.startTime ? 'text-gray-400' : 'text-gray-900 dark:text-white',
											)}
										>
											{form.startTime
												? format(new Date(form.startTime), 'PPPp')
												: 'Pick start time'}
											<CalendarIcon className="h-4 w-4 text-gray-400" />
										</button>
									</PopoverTrigger>
									<PopoverContent className="w-auto p-4 space-y-4 bg-white dark:bg-[#1C1C1E] border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl">
										<Calendar
											mode="single"
											selected={form.startTime ? new Date(form.startTime) : undefined}
											onSelect={(date) => {
												if (!date) return;
												const existingTime = form.startTime ? new Date(form.startTime) : new Date();
												date.setHours(existingTime.getHours(), existingTime.getMinutes());
												setForm({ ...form, startTime: date.toISOString() });
											}}
											initialFocus
											showOutsideDays
										/>
										<input
											type="time"
											className="border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#2C2C2E] text-gray-900 dark:text-white rounded-lg p-2.5 w-full focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition shadow-inner"
											value={form.startTime ? format(new Date(form.startTime), 'HH:mm') : ''}
											onChange={(e) => {
												const [hours, minutes] = e.target.value.split(':').map(Number);
												const date = form.startTime ? new Date(form.startTime) : new Date();
												date.setHours(hours, minutes);
												setForm({ ...form, startTime: date.toISOString() });
											}}
										/>
									</PopoverContent>
								</Popover>
							</div>

							<div>
								<label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
									End Time
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
											{form.endTime ? format(new Date(form.endTime), 'PPPp') : 'Pick end time'}
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
							</div>

							<div>
								<label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
									Source of Truth URL
								</label>
								<input
									type="url"
									name="sourceOfTruth"
									placeholder="https://example.com/resolution-source"
									value={form.sourceOfTruth}
									onChange={handleChange}
									className="w-full p-3.5 border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121214] text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition shadow-sm"
								/>
							</div>
						</div>
					</div>
				);
			case 2:
				return (
					<div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
						<h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Thumbnail</h3>

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
								className={cn('w-12 h-12 mb-4 transition-colors', form.thumbnail ? 'text-gray-900 dark:text-white' : 'text-gray-400')}
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
									step >= i ? 'bg-gray-900 dark:bg-white shadow-sm' : 'bg-gray-200 dark:bg-white/10',
								)}
							/>
							<span className={cn('text-[10px] font-bold uppercase tracking-wider', step >= i ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600')}>
								{s}
							</span>
						</div>
					))}
				</div>

				<Card className="border-gray-200 dark:border-white/5 bg-white dark:bg-[#1C1C1E] shadow-xl dark:shadow-2xl dark:shadow-black/50 rounded-2xl overflow-hidden backdrop-blur-xl">
					<CardContent className="p-6 md:p-8">
						<div className="min-h-[350px]">{renderStep()}</div>

						<div className="flex items-center justify-between mt-10 pt-6 border-t border-gray-100 dark:border-white/5">
							<button
								type="button"
								onClick={() => setStep((prev) => prev - 1)}
								disabled={step === 0}
								className="px-6 py-2.5 rounded-xl font-bold text-sm border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-30 transition-all focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-white/20"
							>
								Back
							</button>

							{step < steps.length - 1 ? (
								<button
									type="button"
									onClick={() => setStep((s) => s + 1)}
									className="px-6 py-2.5 rounded-xl font-bold text-sm bg-gray-900 hover:bg-black text-white dark:bg-white dark:hover:bg-gray-100 dark:text-black shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-white/50"
								>
									Next Step
								</button>
							) : (
								<button
									type="button"
									onClick={handleSubmit}
									disabled={isPending}
									className="px-6 py-2.5 rounded-xl font-bold text-sm bg-gray-900 hover:bg-black text-white dark:bg-white dark:hover:bg-gray-100 dark:text-black shadow-md transition-all disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-white/50 flex items-center justify-center gap-2 min-w-[140px]"
								>
									{isPending ? (
										<>
											<Loader2 className="w-4 h-4 animate-spin" />
											Creating...
										</>
									) : (
										'Create Market'
									)}
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
