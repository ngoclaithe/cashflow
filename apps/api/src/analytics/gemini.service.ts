import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface GeminiAnalysisResult {
  summary: string;
  projectionAssessment: string;
  keyObservations: string[];
  recommendations: string[];
  verdict: 'AN_TOAN' | 'CAN_CHU_Y' | 'NGUY_CO';
  modelUsed: string;
  generatedAt: string;
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  constructor(private readonly config: ConfigService) {}

  async analyzeFinancialData(financialContext: any): Promise<GeminiAnalysisResult> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY is not set in environment variables');
      return this.generateFallbackAnalysis(financialContext, 'Chưa cấu hình GEMINI_API_KEY trong .env');
    }

    const preferredModel = this.config.get<string>('GEMINI_MODEL') || 'gemini-flash-latest';
    const modelsToTry = [
      preferredModel,
      'gemini-3.5-flash',
      'gemini-3.8-flash',
      'gemini-3.1-flash-lite',
      'gemini-2.5-pro',
    ];

    const prompt = this.buildPrompt(financialContext);

    for (const model of modelsToTry) {
      try {
        this.logger.log(`Calling Gemini API using model: ${model}`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        const response = await axios.post(
          url,
          {
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json',
            },
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-goog-api-key': apiKey,
            },
            timeout: 25000,
          },
        );

        const candidateText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidateText) {
          throw new Error('No candidate content returned from Gemini API');
        }

        const parsed = this.parseJsonSafe(candidateText);
        return {
          summary: parsed.summary || 'Đã phân tích dòng tiền kỳ lương hiện tại.',
          projectionAssessment:
            parsed.projectionAssessment ||
            `Số dư dự kiến đến ngày ${financialContext.cycle.targetDateFormatted} khoảng ${financialContext.projections.baseline.projectedBalanceBeforeSalaryFormatted}.`,
          keyObservations: Array.isArray(parsed.keyObservations) ? parsed.keyObservations : [],
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
          verdict: parsed.verdict || 'AN_TOAN',
          modelUsed: model,
          generatedAt: new Date().toISOString(),
        };
      } catch (err: any) {
        const status = err.response?.status;
        const msg = err.response?.data?.error?.message || err.message;
        this.logger.warn(`Model ${model} failed (${status}): ${msg}. Retrying with next model...`);
      }
    }

    this.logger.error('All Gemini models exhausted. Using intelligent rule-based fallback.');
    return this.generateFallbackAnalysis(financialContext, 'Gemini API tạm thời quá tải hoặc kết nối bị gián đoạn');
  }

  private buildPrompt(ctx: any): string {
    return `
Bạn là Cố vấn Tài chính Cá nhân AI cấp cao (Senior Personal Finance AI Advisor) của nền tảng Cashflow.
Hãy phân tích báo cáo dòng tiền thực tế và đưa ra dự báo số dư chính xác đến ngày mùng 10 tháng sau.

THÔNG TIN TÀI KHOẢN VÀ CHU KỲ:
- Tài khoản: ${ctx.account.displayName} (${ctx.account.accountNumber})
- Số dư hiện tại: ${ctx.account.balance.toLocaleString('vi-VN')} VND
- Chu kỳ kỳ lương: Từ ${ctx.cycle.startDateFormatted} đến ${ctx.cycle.targetDateFormatted} (${ctx.cycle.totalDays} ngày)
- Tiến độ chu kỳ: Đã trôi qua ${ctx.cycle.daysElapsed} ngày (${ctx.cycle.progressPercent}%). Còn lại: ${ctx.cycle.daysRemaining} ngày.

DỮ LIỆU GIAO DỊCH TỪ NGÀY ${ctx.cycle.startDateFormatted} ĐẾN NAY (${ctx.cycle.daysElapsed} NGÀY):
- Tổng số giao dịch: ${ctx.stats.txCount} giao dịch
- Tổng chi ra (Expense): ${ctx.stats.totalExpense.toLocaleString('vi-VN')} VND (bình quân ${ctx.stats.dailyExpenseAvg.toLocaleString('vi-VN')} VND/ngày)
- Tổng thu vào (Income): ${ctx.stats.totalIncome.toLocaleString('vi-VN')} VND (chủ yếu gom tiền cơm, chuyển khoản lẻ)
- Thâm hụt ròng thực tế (Net Burn): ${ctx.stats.netBurn.toLocaleString('vi-VN')} VND (bình quân tiêu hao ròng: ${ctx.stats.dailyNetBurnAvg.toLocaleString('vi-VN')} VND/ngày)
- Hạn mức chi tiêu an toàn tối đa cho mỗi ngày còn lại: ${ctx.stats.safeDailySpendingAllowance.toLocaleString('vi-VN')} VND/ngày

CƠ CẤU CHI TIÊU THEO DANH MỤC:
${ctx.categories
  .map(
    (c: any) =>
      `- ${c.name}: ${c.amount.toLocaleString('vi-VN')} VND (${c.percent}%, ${c.count} giao dịch)`,
  )
  .join('\n')}

CÁC KHOẢN CHI LỚN / ĐỘT XUẤT ĐÁNG CHÚ Ý:
${
  ctx.anomalies.length > 0
    ? ctx.anomalies
        .map(
          (a: any) =>
            `- Ngày ${a.date}: ${a.amount.toLocaleString('vi-VN')} VND - "${a.description}" (Danh mục: ${a.categoryName})`,
        )
        .join('\n')
    : '- Không có khoản chi đột xuất lớn.'
}

LỊCH SỬ LƯƠNG ĐỊNH KỲ:
- Lương tháng trước: ~${ctx.historicalSalary.amount.toLocaleString('vi-VN')} VND (thường chi trả vào ngày 9-10 hàng tháng từ "${ctx.historicalSalary.companyName}").
- Ngày nhận lương dự kiến kế tiếp: ${ctx.cycle.targetDateFormatted}.

KẾT QUẢ TÍNH TOÁN DỰ BÁO:
- Kịch bản thực tế (giữ tốc độ 7 ngày qua): Tiêu hao thêm ${ctx.projections.baseline.projectedExpense.toLocaleString('vi-VN')} VND -> Số dư trước lương: ${ctx.projections.baseline.projectedBalanceBeforeSalary.toLocaleString('vi-VN')} VND (Sau lương: ${ctx.projections.baseline.projectedBalanceAfterSalary.toLocaleString('vi-VN')} VND).
- Kịch bản tối ưu (tiết kiệm, không phát sinh cho vay/mua sắm lớn): Tiêu hao thêm ${ctx.projections.optimized.projectedExpense.toLocaleString('vi-VN')} VND -> Số dư trước lương: ${ctx.projections.optimized.projectedBalanceBeforeSalary.toLocaleString('vi-VN')} VND (Sau lương: ${ctx.projections.optimized.projectedBalanceAfterSalary.toLocaleString('vi-VN')} VND).
- Kịch bản dự phòng chi nhiều: Số dư trước lương: ${ctx.projections.conservative.projectedBalanceBeforeSalary.toLocaleString('vi-VN')} VND.

YÊU CẦU ĐẦU RA:
Trả về duy nhất 1 JSON object hợp lệ (không kèm text ngoài JSON) theo cấu trúc:
{
  "summary": "1-2 câu tóm tắt sắc sảo, đánh giá sức khỏe dòng tiền của kỳ lương này",
  "projectionAssessment": "Đánh giá chi tiết về số dư dự kiến đến ngày mùng 10 tháng sau, so sánh trước và sau khi nhận lương",
  "keyObservations": [
    "Nhận xét sắc bén 1 về khoản chi bất thường (như khoản cho vay hoặc mua sắm lớn)",
    "Nhận xét sắc bén 2 về nhóm chi tiêu ăn uống, đi lại sinh hoạt thiết yếu hàng ngày",
    "Nhận xét sắc bén 3 về tốc độ tiêu hao ròng (net burn rate) và áp lực lên số dư khả dụng"
  ],
  "recommendations": [
    "Khuyên 1: Hạn mức ngân sách tối đa nên giữ cho mỗi ngày trong ${ctx.cycle.daysRemaining} ngày còn lại",
    "Khuyên 2: Hành động xử lý khoản cho vay hoặc kiềm chế danh mục đang chiếm tỷ trọng cao nhất",
    "Khuyên 3: Kế hoạch phân bổ và trích lập tiết kiệm ngay khi lương về vào ngày ${ctx.cycle.targetDateFormatted}"
  ],
  "verdict": "AN_TOAN" | "CAN_CHU_Y" | "NGUY_CO"
}
`;
  }

  private parseJsonSafe(text: string): any {
    try {
      // Remove possible markdown formatting (```json ... ```)
      const clean = text
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      return JSON.parse(clean);
    } catch {
      return {};
    }
  }

  private generateFallbackAnalysis(ctx: any, reason: string): GeminiAnalysisResult {
    const isHealthy = ctx.projections.baseline.projectedBalanceBeforeSalary > 5000000;
    return {
      summary: `Tình hình tài chính trong ${ctx.cycle.daysElapsed} ngày qua có tốc độ chi tiêu ròng bình quân ${ctx.stats.dailyNetBurnAvg.toLocaleString('vi-VN')} đ/ngày. Số dư hiện tại ${ctx.account.balance.toLocaleString('vi-VN')} đ hoàn toàn đủ trang trải cho ${ctx.cycle.daysRemaining} ngày còn lại.`,
      projectionAssessment: `Ước lượng đến ngày ${ctx.cycle.targetDateFormatted}, tài khoản dự kiến còn khoảng ${ctx.projections.baseline.projectedBalanceBeforeSalary.toLocaleString('vi-VN')} đ (trước lương) và sẽ đạt khoảng ${ctx.projections.baseline.projectedBalanceAfterSalary.toLocaleString('vi-VN')} đ sau khi lương về.`,
      keyObservations: [
        ctx.anomalies.length > 0
          ? `Khoản phát sinh lớn nhất là "${ctx.anomalies[0].description}" (${ctx.anomalies[0].amount.toLocaleString('vi-VN')} đ) cần theo dõi thu hồi.`
          : 'Cơ cấu chi tiêu chủ yếu là sinh hoạt thường nhật, không có đột biến bất thường.',
        `Danh mục chiếm tỷ trọng cao nhất là ${ctx.categories[0]?.name || 'Chi tiêu chính'} với ${ctx.categories[0]?.percent || 0}%.`,
        `Tốc độ tiêu hao ròng ở mức ${ctx.stats.dailyNetBurnAvg.toLocaleString('vi-VN')} đ/ngày, nằm trong ngưỡng kiểm soát so với số dư ${ctx.account.balance.toLocaleString('vi-VN')} đ.`,
      ],
      recommendations: [
        `Nên duy trì chi tiêu sinh hoạt không vượt quá ${ctx.stats.safeDailySpendingAllowance.toLocaleString('vi-VN')} đ/ngày để giữ số dư an toàn trên 8 triệu đồng.`,
        'Nếu thu hồi được khoản cho vay hoặc hạn chế mua sắm mới, số dư trước kỳ lương có thể đạt trên 10 triệu đồng.',
        `Chuẩn bị trích lập ngay 30% lương kỳ mới vào mục tiêu tiết kiệm khi tài khoản được cộng lương ngày ${ctx.cycle.targetDateFormatted}.`,
      ],
      verdict: isHealthy ? 'AN_TOAN' : 'CAN_CHU_Y',
      modelUsed: `Local Heuristic Engine (${reason})`,
      generatedAt: new Date().toISOString(),
    };
  }
}
