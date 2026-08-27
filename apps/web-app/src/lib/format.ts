export const formatAmount = (value: number | string | undefined | null): string => {
	if (value === undefined || value === null) return '0';
	const num = Number(value);
	if (isNaN(num)) return '0';
	return num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

export const formatINR = (value: number | string | undefined | null): string => {
	if (value === undefined || value === null) return '₹0.00';
	const num = Number(value);
	if (isNaN(num)) return '₹0.00';

	if (num >= 10000000) {
		return `₹${(num / 10000000).toFixed(2)}Cr`;
	} else if (num >= 100000) {
		return `₹${(num / 100000).toFixed(2)}L`;
	} else if (num >= 1000) {
		return `₹${(num / 1000).toFixed(2)}K`;
	}

	return `₹${num.toFixed(2)}`;
};

export const formatNumber = (value: number | string | undefined | null): string => {
	if (value === undefined || value === null) return '0';
	const num = Number(value);
	if (isNaN(num)) return '0';

	if (num >= 10000000) {
		return `${(num / 10000000).toFixed(2)}Cr`;
	} else if (num >= 100000) {
		return `${(num / 100000).toFixed(2)}L`;
	} else if (num >= 1000) {
		return `${(num / 1000).toFixed(2)}K`;
	}

	return num.toString();
};

export const formatDate = (dateString: string | Date | undefined | null): string => {
	if (!dateString) return 'N/A';
	const date = new Date(dateString);
	return date.toLocaleDateString('en-IN', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
};

export const formatRelativeTime = (dateString: string | Date | undefined | null): string => {
	if (!dateString) return 'N/A';

	const date = new Date(dateString);
	const now = new Date();
	const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

	if (diffInSeconds < 60) {
		return 'Just now';
	}

	const diffInMinutes = Math.floor(diffInSeconds / 60);
	if (diffInMinutes < 60) {
		return `${diffInMinutes}m ago`;
	}

	const diffInHours = Math.floor(diffInMinutes / 60);
	if (diffInHours < 24) {
		return `${diffInHours}h ago`;
	}

	const diffInDays = Math.floor(diffInHours / 24);
	if (diffInDays < 7) {
		return `${diffInDays}d ago`;
	}

	return date.toLocaleDateString('en-IN', {
		month: 'short',
		day: 'numeric',
	});
};
