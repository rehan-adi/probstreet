import api, { adminApi } from '@/config/axios';

export const getKycVerififcationStatus = () => {
	return api.get('/verification/status');
};

export const getKycVerififcationDetails = () => {
	return api.get('/verification');
};

export const submitKyc = (panName: string, panNumber: string, DOB: string) => {
	return api.post('/verification/kyc/submit', { panName, panNumber, DOB });
};

export const submitPaymentMethod = (upiId: string, bankAccountNumber: string, ifscCode: string) => {
	return api.post('/verification/payment-method/submit', { upiId, bankAccountNumber, ifscCode });
};

export const getAllPendingVerifications = () => {
	return adminApi.get('/verification/pending');
};

export const getUserVerificationDetails = async (userId: string) => {
	const response = await adminApi.get(`/verification/${userId}`);
	return response.data;
};

export const verify = (
	userId: string,
	kycStatus?: string,
	paymentStatus?: string,
	kycRemark?: string,
	paymentRemark?: string,
) => {
	return adminApi.post('/verification/verify', {
		userId,
		kycStatus,
		kycRemark,
		paymentStatus,
		paymentRemark,
	});
};

export const deletePaymentMethod = (id: string) => {
	return api.delete(`/verification/payment-method/${id}`);
};
