import { api } from '@/lib/axios';

export const getBalance = () => {
	return api.get('/balance/get');
};

export const getDepositAmount = () => {
	return api.get('/balance/deposit');
};

export const deposit = (amount: string) => {
	return api.post('/balance/deposit', { amount });
};

export const withdraw = (amount: string, currentWalletAmount: string, paymentMethodId: string) => {
	return api.post('/balance/withdraw', { amount, currentWalletAmount, paymentMethodId });
};
