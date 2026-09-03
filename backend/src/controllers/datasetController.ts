import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { PrismaClient, BatchStatus } from '@prisma/client';
import { parseCSVBuffer } from '../utils/csvParser';

const prisma = new PrismaClient();

export const uploadDataset = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    if (!files || Object.keys(files).length === 0) {
      return res.status(400).json({ error: 'No CSV files uploaded. Please upload the 5 required CSV files.' });
    }

    const ordersFile = files['orders']?.[0];
    const paymentsFile = files['payments']?.[0];
    const settlementsFile = files['settlements']?.[0];
    const bankFile = files['bank_transactions']?.[0];
    const refundsFile = files['refunds']?.[0];

    if (!ordersFile || !paymentsFile || !settlementsFile || !bankFile) {
      return res.status(400).json({
        error: 'Missing required reconciliation files. Required: orders.csv, payments.csv, settlements.csv, bank_transactions.csv',
      });
    }

    // Parse CSV buffers
    const ordersData = await parseCSVBuffer(ordersFile.buffer);
    const paymentsData = await parseCSVBuffer(paymentsFile.buffer);
    const settlementsData = await parseCSVBuffer(settlementsFile.buffer);
    const bankData = await parseCSVBuffer(bankFile.buffer);
    const refundsData = refundsFile ? await parseCSVBuffer(refundsFile.buffer) : [];

    // Calculate dynamic total transaction records from payments/bank
    const txIds = new Set<string>();
    paymentsData.forEach((row: any) => row.transaction_id && txIds.add(row.transaction_id));
    settlementsData.forEach((row: any) => row.transaction_id && txIds.add(row.transaction_id));
    bankData.forEach((row: any) => {
      const ref = row.reference || row.bank_transaction_id;
      if (ref && !ref.startsWith('UNKNOWN')) txIds.add(ref);
    });

    const totalRecordCount = Math.max(txIds.size, paymentsData.length, bankData.length);

    const batchName = req.body.name || `Batch_${new Date().toISOString().slice(0, 10)}_${Date.now().toString().slice(-4)}`;
    const description = req.body.description || `Uploaded dataset containing ${totalRecordCount} financial records.`;

    // Create DatasetBatch in DB
    const batch = await prisma.datasetBatch.create({
      data: {
        name: batchName,
        description,
        recordCount: totalRecordCount,
        status: BatchStatus.READY,
      },
    });

    // Save records to PostgreSQL
    if (ordersData.length > 0) {
      await prisma.order.createMany({
        data: ordersData.map((row: any) => ({
          batchId: batch.id,
          orderId: String(row.order_id || '').trim(),
          customerId: row.customer_id ? String(row.customer_id).trim() : null,
          orderDate: String(row.order_date || '').trim(),
          orderAmount: parseFloat(row.order_amount) || 0.0,
          currency: String(row.currency || 'INR').trim(),
          paymentId: row.payment_id ? String(row.payment_id).trim() : null,
          orderStatus: String(row.order_status || 'COMPLETED').trim(),
        })),
      });
    }

    if (paymentsData.length > 0) {
      await prisma.payment.createMany({
        data: paymentsData.map((row: any) => ({
          batchId: batch.id,
          paymentId: String(row.payment_id || '').trim(),
          orderId: row.order_id ? String(row.order_id).trim() : null,
          transactionId: String(row.transaction_id || '').trim(),
          paymentDate: String(row.payment_date || '').trim(),
          paymentTime: String(row.payment_time || '00:00:00').trim(),
          amount: parseFloat(row.amount) || 0.0,
          paymentStatus: String(row.payment_status || 'CAPTURED').trim(),
          paymentMethod: String(row.payment_method || 'UPI').trim(),
        })),
      });
    }

    if (settlementsData.length > 0) {
      await prisma.settlement.createMany({
        data: settlementsData.map((row: any) => ({
          batchId: batch.id,
          settlementId: String(row.settlement_id || '').trim(),
          transactionId: String(row.transaction_id || '').trim(),
          settlementDate: String(row.settlement_date || '').trim(),
          grossAmount: parseFloat(row.gross_amount) || 0.0,
          fee: parseFloat(row.fee) || 0.0,
          tax: parseFloat(row.tax) || 0.0,
          netAmount: parseFloat(row.net_amount) || 0.0,
          settlementStatus: String(row.settlement_status || 'SETTLED').trim(),
        })),
      });
    }

    if (bankData.length > 0) {
      await prisma.bankTransaction.createMany({
        data: bankData.map((row: any) => ({
          batchId: batch.id,
          bankTransactionId: String(row.bank_transaction_id || '').trim(),
          settlementId: row.settlement_id ? String(row.settlement_id).trim() : null,
          transactionDate: String(row.transaction_date || '').trim(),
          transactionTime: String(row.transaction_time || '00:00:00').trim(),
          reference: row.reference ? String(row.reference).trim() : null,
          creditAmount: parseFloat(row.credit_amount) || 0.0,
          bankStatus: String(row.bank_status || 'CREDITED').trim(),
        })),
      });
    }

    if (refundsData.length > 0) {
      await prisma.refund.createMany({
        data: refundsData.map((row: any) => ({
          batchId: batch.id,
          refundId: String(row.refund_id || '').trim(),
          transactionId: String(row.transaction_id || '').trim(),
          refundDate: String(row.refund_date || '').trim(),
          refundAmount: parseFloat(row.refund_amount) || 0.0,
          refundStatus: String(row.refund_status || 'PROCESSED').trim(),
          refundReason: row.refund_reason ? String(row.refund_reason).trim() : null,
        })),
      });
    }

    // Record Audit Log
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId,
        action: 'DATASET_UPLOAD',
        entity: 'DatasetBatch',
        entityId: batch.id,
        newValue: batch.name,
        reason: `Uploaded ${totalRecordCount} financial records across 5 CSV files.`,
        metadata: {
          recordCount: totalRecordCount,
          ordersCount: ordersData.length,
          paymentsCount: paymentsData.length,
          settlementsCount: settlementsData.length,
          bankCount: bankData.length,
          refundsCount: refundsData.length,
        },
      },
    });

    return res.status(201).json({
      message: 'Dataset uploaded and validated successfully.',
      batch: {
        id: batch.id,
        name: batch.name,
        recordCount: totalRecordCount,
        status: batch.status,
        uploadedAt: batch.uploadedAt,
      },
      counts: {
        orders: ordersData.length,
        payments: paymentsData.length,
        settlements: settlementsData.length,
        bankTransactions: bankData.length,
        refunds: refundsData.length,
      },
    });
  } catch (error: any) {
    console.error('Dataset upload error:', error);
    return res.status(500).json({ error: `Dataset upload failed: ${error.message}` });
  }
};

export const getDatasets = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const batches = await prisma.datasetBatch.findMany({
      orderBy: { uploadedAt: 'desc' },
      include: {
        _count: {
          select: {
            orders: true,
            payments: true,
            settlements: true,
            bankTxns: true,
            refunds: true,
            runs: true,
          },
        },
      },
    });

    return res.status(200).json({ batches });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch datasets.' });
  }
};

export const getDatasetById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const batch = await prisma.datasetBatch.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            orders: true,
            payments: true,
            settlements: true,
            bankTxns: true,
            refunds: true,
            runs: true,
          },
        },
      },
    });

    if (!batch) {
      return res.status(404).json({ error: 'Dataset batch not found.' });
    }

    return res.status(200).json({ batch });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch dataset details.' });
  }
};
