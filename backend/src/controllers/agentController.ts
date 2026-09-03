import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { processAgentChat } from '../services/agentService';

export const processAgentChatHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Please provide a valid text prompt for the AI Finance Controller Agent.' });
    }

    const result = await processAgentChat(message.trim(), Array.isArray(history) ? history : [], req.user?.userId);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Error in processAgentChatHandler:', error);
    return res.status(500).json({ error: error.message || 'AI Finance Controller Agent execution failed.' });
  }
};
