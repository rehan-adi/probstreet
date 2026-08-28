import { toast } from 'sonner';
import { adminApi } from '@/config/axios';
import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/format';
import AdminLayout from '@/components/admin/AdminLayout';
import { Loader2, Search, User, Mail, Phone, CalendarDays, ShieldCheck } from 'lucide-react';

export default function AdminUsers() {
	const [users, setUsers] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [globalFilter, setGlobalFilter] = useState('');
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);

	const fetchUsers = async () => {
		try {
			const res = await adminApi.get(`/users?page=${page}&limit=20`);
			if (res.data.success) {
				setUsers(res.data.data);
				setTotalPages(res.data.meta?.totalPages || 1);
			}
		} catch (err) {
			console.error('Failed to fetch users', err);
			toast.error('Failed to fetch users');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchUsers();
	}, [page]);

	const filteredUsers = users.filter((u) => {
		if (!globalFilter) return true;
		const s = globalFilter.toLowerCase();
		return (
			u.username?.toLowerCase().includes(s) ||
			u.email?.toLowerCase().includes(s) ||
			u.id?.toLowerCase().includes(s)
		);
	});

	if (loading) {
		return (
			<AdminLayout>
				<div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] gap-3">
					<Loader2 className="animate-spin w-6 h-6 text-gray-600 dark:text-gray-400" />
					<p className="text-sm font-medium text-gray-500">Loading users...</p>
				</div>
			</AdminLayout>
		);
	}

	return (
		<AdminLayout>
			<div className="space-y-6 max-w-350 mx-auto">
				{/* Top Header */}
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
					<div>
						<h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
							Users
						</h1>
						<p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
							Manage registered accounts and verification statuses.
						</p>
					</div>

					<div className="relative w-full sm:w-80">
						<Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
						<input
							type="text"
							placeholder="Search by username, email, ID..."
							value={globalFilter}
							onChange={(e) => setGlobalFilter(e.target.value)}
							className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-[#090C1A] border border-gray-300 dark:border-white/10 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition shadow-sm"
						/>
					</div>
				</div>

				{/* Table Container */}
				<div className="bg-white dark:bg-[#090C1A] border border-gray-200 dark:border-white/5 rounded-xl shadow-xs overflow-hidden relative">
					<div className="overflow-x-auto">
						<table className="w-full text-left text-sm whitespace-nowrap">
							<thead className="bg-gray-50 dark:bg-[#090C1A]/50 border-b border-gray-200 dark:border-white/5 text-gray-500 dark:text-gray-400 font-semibold text-xs tracking-wide">
								<tr>
									<th className="py-3.5 px-4 uppercase">User</th>
									<th className="py-3.5 px-4 uppercase">Contact Info</th>
									<th className="py-3.5 px-4 uppercase">KYC</th>
									<th className="py-3.5 px-4 uppercase">Payment</th>
									<th className="py-3.5 px-4 uppercase">Role</th>
									<th className="py-3.5 px-4 uppercase">Joined At</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-100 dark:divide-white/5">
								{filteredUsers.length ? (
									filteredUsers.map((user) => (
										<tr
											key={user.id}
											className="hover:bg-gray-50/80 dark:hover:bg-white/5 transition-colors group"
										>
											<td className="py-4 px-4">
												<div className="flex items-center gap-3">
													<div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-800 dark:text-gray-200 font-bold text-xs border border-transparent dark:border-white/5">
														{user.username?.charAt(0).toUpperCase() || 'U'}
													</div>
													<div className="flex flex-col">
														<span className="font-semibold text-sm text-gray-900 dark:text-white">
															{user.username || 'No username'}
														</span>
														<span className="text-[11px] font-mono text-gray-400 dark:text-gray-500">
															ID: {user.id.substring(0, 8)}...
														</span>
													</div>
												</div>
											</td>
											<td className="py-4 px-4">
												<div className="flex flex-col gap-0.5">
													{user.email && (
														<div className="flex items-center text-xs font-medium text-gray-600 dark:text-gray-300">
															<Mail className="w-3 h-3 mr-1.5 opacity-50" />
															{user.email}
														</div>
													)}
													{user.phone && (
														<div className="flex items-center text-xs font-medium text-gray-600 dark:text-gray-300">
															<Phone className="w-3 h-3 mr-1.5 opacity-50" />
															{user.phone}
														</div>
													)}
													{!user.email && !user.phone && (
														<span className="text-xs italic text-gray-400">No contact info</span>
													)}
												</div>
											</td>
											<td className="py-4 px-4">
												<span
													className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-md uppercase tracking-wider border ${
														user.kycVerificationStatus === 'VERIFIED'
															? 'bg-gray-100 text-gray-900 border-gray-200 dark:bg-white/10 dark:text-white dark:border-white/20'
															: user.kycVerificationStatus === 'PENDING'
																? 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10'
																: 'bg-transparent text-gray-400 border-gray-200 dark:border-white/5'
													}`}
												>
													{user.kycVerificationStatus === 'VERIFIED' && (
														<div className="w-1.5 h-1.5 rounded-full bg-black dark:bg-white" />
													)}
													{user.kycVerificationStatus === 'PENDING' && (
														<div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
													)}
													{user.kycVerificationStatus === 'VERIFIED'
														? 'Verified'
														: user.kycVerificationStatus === 'PENDING'
															? 'Pending'
															: 'Unverified'}
												</span>
											</td>
											<td className="py-4 px-4">
												<span
													className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-md uppercase tracking-wider border ${
														user.paymentVerificationStatus === 'VERIFIED'
															? 'bg-gray-100 text-gray-900 border-gray-200 dark:bg-white/10 dark:text-white dark:border-white/20'
															: user.paymentVerificationStatus === 'PENDING'
																? 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10'
																: 'bg-transparent text-gray-400 border-gray-200 dark:border-white/5'
													}`}
												>
													{user.paymentVerificationStatus === 'VERIFIED' && (
														<div className="w-1.5 h-1.5 rounded-full bg-black dark:bg-white" />
													)}
													{user.paymentVerificationStatus === 'PENDING' && (
														<div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
													)}
													{user.paymentVerificationStatus === 'VERIFIED'
														? 'Verified'
														: user.paymentVerificationStatus === 'PENDING'
															? 'Pending'
															: 'Unverified'}
												</span>
											</td>
											<td className="py-4 px-4">
												<div className="flex items-center gap-1.5">
													{user.role === 'ADMIN' && (
														<ShieldCheck className="w-3.5 h-3.5 text-black dark:text-white" />
													)}
													<span
														className={`text-xs font-bold ${
															user.role === 'ADMIN'
																? 'text-gray-900 dark:text-white'
																: 'text-gray-500'
														}`}
													>
														{user.role === 'ADMIN' ? 'Admin' : 'User'}
													</span>
												</div>
											</td>
											<td className="py-4 px-4">
												<div className="flex items-center text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
													<CalendarDays className="w-3.5 h-3.5 mr-1.5 opacity-50" />
													{formatDate(user.createdAt)}
												</div>
											</td>
										</tr>
									))
								) : (
									<tr>
										<td colSpan={6} className="h-48 text-center">
											<div className="flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
												<User className="w-8 h-8 mb-3 opacity-20" />
												<p className="text-sm font-medium">No users found.</p>
											</div>
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>

					{/* Pagination Footer */}
					<div className="flex items-center justify-between py-3 px-4 border-t border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-transparent">
						<div className="text-xs font-medium text-gray-500 dark:text-gray-400">
							Showing Page <span className="text-gray-900 dark:text-white">{page}</span> of{' '}
							<span className="text-gray-900 dark:text-white">{totalPages}</span>
						</div>
						<div className="flex items-center gap-2">
							<button
								onClick={() => setPage((p) => Math.max(1, p - 1))}
								disabled={page <= 1}
								className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-50 transition cursor-pointer"
							>
								Prev
							</button>
							<button
								onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
								disabled={page >= totalPages}
								className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-50 transition cursor-pointer"
							>
								Next
							</button>
						</div>
					</div>
				</div>
			</div>
		</AdminLayout>
	);
}
