import { createMarket } from '@/api/market';
import { useMutation } from '@tanstack/react-query';

type CreateEventPayload = {
	title: string;
	eos?: string;
	rules?: string;
	startTime?: string;
	endTime: string;
	sourceOfTruth?: string;
	resolutionMode?: 'MANUAL' | 'AUTOMATIC';
	oracleConfig?: Record<string, any>;
	categoryId: string;
	thumbnail: string | null;
};

export const useCreateEventMutation = () => {
	return useMutation({
		mutationKey: ['event'],
		mutationFn: (payload: CreateEventPayload) => createMarket(payload),
	});
};

import { splitShares, mergeShares } from '@/api/market';

export const useSplitSharesMutation = () => {
	return useMutation({
		mutationKey: ['splitShares'],
		mutationFn: ({ symbol, quantity }: { symbol: string; quantity: number }) =>
			splitShares(symbol, quantity),
	});
};

export const useMergeSharesMutation = () => {
	return useMutation({
		mutationKey: ['mergeShares'],
		mutationFn: ({ symbol, quantity }: { symbol: string; quantity: number }) =>
			mergeShares(symbol, quantity),
	});
};
