import { useEffect, useState } from 'react';
import { adminApi } from '@/config/axios';
import { toast } from 'sonner';
import {
	Loader2,
	Search,
	ArrowUpRight,
	ArrowDownRight,
	WalletCards,
	CreditCard,
	Banknote,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import {
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { formatINR, formatDate } from '@/lib/format';

export default function AdminTransactions() {
	const [transactions, setTransactions] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [globalFilter, setGlobalFilter] = useState('');
	const [typeFilter, setTypeFilter] = useState('ALL');

	const fetchTransactions = async () => {
		try {
			const res = await adminApi.get(`/transactions`);
			if (res.data.success) {
				setTransactions(res.data.data);
			}
		} catch (err) {
			console.error('Failed to fetch transactions', err);
			toast.error('Failed to fetch transactions');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchTransactions();
	}, []);

	const filteredTransactions = transactions.filter((t) =>
		typeFilter === 'ALL' ? true : t.type === typeFilter,
	);

	const getTransactionIcon = (type: string) => {
		switch (type) {
			case 'DEPOSIT':
				return <ArrowDownRight className="w-3.5 h-3.5" />;
			case 'WITHDRAWAL':
				return <ArrowUpRight className="w-3.5 h-3.5" />;
			case 'TRADE':
				return <Banknote className="w-3.5 h-3.5" />;
			case 'FEE':
				return <CreditCard className="w-3.5 h-3.5" />;
			default:
				return <WalletCards className="w-3.5 h-3.5" />;
		}
	};

	const columns = [
		{
			accessorKey: 'id',
			header: 'Transaction ID',
			cell: ({ row }: any) => {
				const id = row.getValue('id');
				return (
					<div className="font-mono text-[11px] font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/5 px-2 py-1 rounded w-fit border border-gray-100 dark:border-white/5">
						{id.substring(0, 12)}...
					</div>
				);
			},
		},
		{
			accessorKey: 'user.email',
			header: 'User',
			cell: ({ row }: any) => {
				const user = row.original.user;
				return (
					<div className="flex flex-col">
						<span className="font-semibold text-sm text-gray-900 dark:text-white">
							{user?.username || 'System'}
						</span>
						<span className="text-xs text-gray-500 dark:text-gray-400">{user?.email || 'N/A'}</span>
					</div>
				);
			},
		},
		{
			accessorKey: 'type',
			header: 'Type',
			cell: ({ row }: any) => {
				const type = row.getValue('type');
				return (
					<span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md tracking-wide border bg-gray-50 text-gray-700 border-gray-200 dark:bg-white/5 dark:text-gray-300 dark:border-white/10">
						{getTransactionIcon(type)}
						{type}
					</span>
				);
			},
		},
		{
			accessorKey: 'amount',
			header: 'Amount',
			cell: ({ row }: any) => {
				const amount = Number(row.getValue('amount'));
				const type = row.original.type;

				const isPositive = ['DEPOSIT', 'WINNINGS', 'REFUND'].includes(type);
				const isNegative = ['WITHDRAWAL', 'TRADE', 'FEE'].includes(type);

				return (
					<div
						className={`font-bold text-sm tracking-tight ${
							isPositive
								? 'text-emerald-600 dark:text-emerald-400'
								: isNegative
									? 'text-gray-900 dark:text-white'
									: 'text-gray-500 dark:text-gray-400'
						}`}
					>
						{isPositive ? '+' : isNegative ? '-' : ''}
						{formatINR(Math.abs(amount))}
					</div>
				);
			},
		},
		{
			accessorKey: 'status',
			header: 'Status',
			cell: ({ row }: any) => {
				const status = row.getValue('status');

				if (status === 'COMPLETED' || status === 'SUCCESS') {
					return (
						<span className="flex items-center text-xs font-bold text-emerald-600 dark:text-emerald-400">
							<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Completed
						</span>
					);
				}
				if (status === 'PENDING') {
					return (
						<span className="flex items-center text-xs font-bold text-gray-600 dark:text-gray-400">
							<span className="w-1.5 h-1.5 rounded-full bg-gray-500 mr-1.5 animate-pulse"></span>
							Pending
						</span>
					);
				}
				if (status === 'FAILED') {
					return (
						<span className="flex items-center text-xs font-bold text-red-600 dark:text-red-400">
							<span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span>Failed
						</span>
					);
				}
				return <span className="text-xs font-bold text-gray-500 uppercase">{status}</span>;
			},
		},
		{
			accessorKey: 'createdAt',
			header: 'Date',
			cell: ({ row }: any) => (
				<span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap font-medium">
					{formatDate(row.getValue('createdAt'))}
				</span>
			),
		},
	];

	const table = useReactTable({
		data: filteredTransactions,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		globalFilterFn: 'includesString',
		state: {
			globalFilter,
		},
		onGlobalFilterChange: setGlobalFilter,
		initialState: {
			pagination: {
				pageSize: 15,
			},
		},
	});

	if (loading) {
		return (
			<AdminLayout>
				<div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] gap-3">
					<Loader2 className="animate-spin w-6 h-6 text-gray-600 dark:text-gray-400" />
					<p className="text-sm font-medium text-gray-500">Loading transactions...</p>
				</div>
			</AdminLayout>
		);
	}

	const filterOptions = ['ALL', 'DEPOSIT', 'WITHDRAWAL', 'TRADE', 'FEE'];

	return (
		<AdminLayout>
			<div className="space-y-6 max-w-350 mx-auto">
				{/* Header */}
				<div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
					<div>
						<h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
							Transactions
						</h1>
						<p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
							View and monitor all financial activity across the platform.
						</p>
					</div>

					<div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
						{/* Custom Filter Tabs */}
						<div className="flex p-1 bg-gray-100 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/5 w-full sm:w-auto overflow-x-auto custom-scrollbar">
							{filterOptions.map((opt) => (
								<button
									key={opt}
									onClick={() => setTypeFilter(opt)}
									className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
										typeFilter === opt
											? 'bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-white/10'
											: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border border-transparent'
									}`}
								>
									{opt === 'ALL' ? 'All' : opt.charAt(0) + opt.slice(1).toLowerCase() + 's'}
								</button>
							))}
						</div>

						{/* Search Bar */}
						<div className="relative w-full sm:w-64 shrink-0">
							<Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
							<input
								type="text"
								placeholder="Search transactions..."
								value={globalFilter ?? ''}
								onChange={(e) => setGlobalFilter(e.target.value)}
								className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-[#121214] border border-gray-300 dark:border-white/10 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition shadow-sm"
							/>
						</div>
					</div>
				</div>

				{/* Table Container */}
				<div className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-xl shadow-xs overflow-hidden relative">
					<div className="overflow-x-auto">
						<table className="w-full text-left text-sm whitespace-nowrap">
							<thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/5 text-gray-500 dark:text-gray-400 font-semibold text-xs tracking-wide">
								{table.getHeaderGroups().map((headerGroup) => (
									<tr key={headerGroup.id}>
										{headerGroup.headers.map((header) => (
											<th key={header.id} className="py-3.5 px-4 uppercase">
												{header.isPlaceholder
													? null
													: flexRender(header.column.columnDef.header, header.getContext())}
											</th>
										))}
									</tr>
								))}
							</thead>
							<tbody className="divide-y divide-gray-100 dark:divide-white/5">
								{table.getRowModel().rows?.length ? (
									table.getRowModel().rows.map((row) => (
										<tr
											key={row.id}
											className="hover:bg-gray-50/80 dark:hover:bg-white/5 transition-colors group"
										>
											{row.getVisibleCells().map((cell) => (
												<td key={cell.id} className="py-4 px-4">
													{flexRender(cell.column.columnDef.cell, cell.getContext())}
												</td>
											))}
										</tr>
									))
								) : (
									<tr>
										<td colSpan={columns.length} className="h-48 text-center">
											<div className="flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
												<WalletCards className="w-8 h-8 mb-3 opacity-20" />
												<p className="text-sm font-medium">No transactions found.</p>
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
							Showing{' '}
							<span className="text-gray-900 dark:text-white">
								{table.getRowModel().rows.length}
							</span>{' '}
							of{' '}
							<span className="text-gray-900 dark:text-white">{filteredTransactions.length}</span>{' '}
							transactions
						</div>
						<div className="flex items-center gap-2">
							<button
								onClick={() => table.previousPage()}
								disabled={!table.getCanPreviousPage()}
								className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-50 transition cursor-pointer"
							>
								Prev
							</button>
							<button
								onClick={() => table.nextPage()}
								disabled={!table.getCanNextPage()}
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
