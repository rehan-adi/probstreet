import { ENV } from '@/config/env';
import { logger } from '@/libs/logger';

const IS_PROD = ENV.NODE_ENV === 'production';
const PAYOUT_V2_BASE_URL = IS_PROD
	? 'https://api.cashfree.com/payout'
	: 'https://sandbox.cashfree.com/payout';

export type PayoutRequest = {
	transferId: string;
	amount: number;
	paymentMethod: {
		type: 'UPI' | 'BANK';
		upiNumber?: string | null;
		accountNumber?: string | null;
		ifscCode?: string | null;
		name?: string;
		email?: string;
		phone?: string;
	};
};

export async function triggerCashfreePayout(request: PayoutRequest): Promise<any> {
	const beneficiaryId = `bene_${request.transferId.slice(0, 20)}`;

	const payload: any = {
		transfer_id: request.transferId,
		transfer_amount: Number(request.amount.toFixed(2)),
		transfer_currency: 'INR',
		transfer_mode: request.paymentMethod.type === 'UPI' ? 'upi' : 'banktransfer',
		transfer_purpose: 'WALLET_WITHDRAWAL',
		beneficiary_details: {
			beneficiary_id: beneficiaryId,
			beneficiary_name: request.paymentMethod.name || 'Probstreet User',
			beneficiary_instrument_details:
				request.paymentMethod.type === 'UPI'
					? {
							vpa: request.paymentMethod.upiNumber,
						}
					: {
							bank_account_number: request.paymentMethod.accountNumber,
							bank_ifsc: request.paymentMethod.ifscCode,
						},
			beneficiary_contact_details: {
				beneficiary_email: request.paymentMethod.email || 'user@probstreet.com',
				beneficiary_phone: request.paymentMethod.phone || '9999999999',
			},
		},
	};

	try {
		const beneResponse = await fetch(`${PAYOUT_V2_BASE_URL}/beneficiary`, {
			method: 'POST',
			headers: {
				'x-client-id': ENV.CASHFREE_PAYOUT_CLIENT_ID,
				'x-client-secret': ENV.CASHFREE_PAYOUT_CLIENT_SECRET,
				'x-api-version': '2024-01-01',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload.beneficiary_details),
		});

		const beneData = await beneResponse.json().catch(() => ({}));

		// @ts-ignore
		if (!beneResponse.ok && beneData.code !== 'conflict_with_existing_beneficiary') {
			logger.error({ status: beneResponse.status, data: beneData }, 'Failed to create beneficiary');
			// @ts-ignore
			throw new Error(beneData.message || 'Failed to create Cashfree beneficiary');
		}

		const response = await fetch(`${PAYOUT_V2_BASE_URL}/transfers`, {
			method: 'POST',
			headers: {
				'x-client-id': ENV.CASHFREE_PAYOUT_CLIENT_ID,
				'x-client-secret': ENV.CASHFREE_PAYOUT_CLIENT_SECRET,
				'x-api-version': '2024-01-01',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload),
		});

		const rawText = await response.text();

		let data: any;

		try {
			data = JSON.parse(rawText);
		} catch (e) {
			data = { raw: rawText };
		}

		if (!response.ok) {
			logger.warn(
				{ status: response.status, data, transferId: request.transferId },
				'Cashfree Payouts v2 response notice',
			);

			throw new Error(
				data.message || `Cashfree Payout v2 API failed with status ${response.status}`,
			);
		}

		logger.info(
			{
				transferId: request.transferId,
				data,
			},
			'Cashfree Payouts v2 Triggered Successfully',
		);
		return data;
	} catch (error) {
		logger.error({ error, request }, 'Error triggering Cashfree Payouts v2');
		throw error;
	}
}

export async function getPayoutStatusV2(transferId: string): Promise<any> {
	try {
		const response = await fetch(`${PAYOUT_V2_BASE_URL}/transfers/${transferId}`, {
			method: 'GET',
			headers: {
				'x-client-id': ENV.CASHFREE_PAYOUT_CLIENT_ID,
				'x-client-secret': ENV.CASHFREE_PAYOUT_CLIENT_SECRET,
				'x-api-version': '2024-01-01',
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			const text = await response.text();
			logger.warn({ status: response.status, text }, 'Failed to fetch Payout v2 status');
			return null;
		}

		return await response.json();
	} catch (error) {
		logger.error({ error, transferId }, 'Error fetching Payout v2 status');
		return null;
	}
}
