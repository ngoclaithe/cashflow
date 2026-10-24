import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface GeminiAnalysisResult {
  summary: string;
  projectionAssessment: string;
  customAnswer?: string;
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

    // Cố định 2 model Gemini: 3.6 Flash và 3.8 Flash theo yêu cầu
    const modelsToTry = ['gemini-3.6-flash', 'gemini-3.8-flash'];

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
            timeout: 30000,
          },
        );

        const candidateText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidateText) {
          throw new Error('No candidate content returned from Gemini API');
        }

        const parsed = this.parseJsonSafe(candidateText);
        return {
          summary: parsed.summary || 'Đã phân tích dòng tiền theo khoảng thời gian bạn yêu cầu.',
          projectionAssessment:
            parsed.projectionAssessment ||
            `Số dư dự kiến đến ngày ${financialContext.timeframe.targetDateFormatted} khoảng ${financialContext.projections.baseline.projectedBalanceBeforeSalaryFormatted}.`,
          customAnswer: parsed.customAnswer || (financialContext.customQuestion ? 'Đã phân tích câu hỏi của bạn dựa trên dữ liệu giao dịch.' : undefined),
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
    const customInquirySection = ctx.customQuestion
      ? `\nCÂU HỎI / YÊU CẦU RIÊNG CỦA NGƯỜI DÙNG:
"${ctx.customQuestion}"
Hãy trả lời riêng câu hỏi này một cách cụ thể, thấu đáo và thực tế dựa trên dữ liệu dòng tiền của người dùng vào trường "customAnswer".\n`
      : '';

    const upcomingExpensesText = ctx.upcoming?.expensesList?.length > 0
      ? ctx.upcoming.expensesList
          .map((item: any) => `- Ngày ${item.dueDate}: ${item.name} (${item.amount.toLocaleString('vi-VN')} VND)`)
          .join('\n')
      : '- Không có khoản chi lớn đặc biệt sắp tới.';

    const upcomingIncomesText = ctx.upcoming?.incomesList?.length > 0
      ? ctx.upcoming.incomesList
          .map((item: any) => `- Ngày ${item.dueDate}: ${item.name} (+${item.amount.toLocaleString('vi-VN')} VND)`)
          .join('\n')
      : '- Không có khoản thu đặc biệt sắp tới.';

    return `
Bạn là Cố vấn Tài chính Cá nhân AI cấp cao (Senior Personal Finance AI Advisor) của nền tảng Cashflow.
Hãy phân tích báo cáo dữ liệu thu chi thực tế của người dùng và đưa ra dự báo số dư chính xác cho ngày mục tiêu.
${customInquirySection}
THÔNG TIN TÀI KHOẢN VÀ THỜI GIAN:
- Tài khoản: ${ctx.account.displayName} (${ctx.account.accountNumber})
- Số dư hiện tại: ${ctx.account.balance.toLocaleString('vi-VN')} VND
- Khoảng thời gian dữ liệu phân tích: Từ ngày ${ctx.timeframe.startDateFormatted} đến ngày ${ctx.timeframe.endDateFormatted} (${ctx.timeframe.analysisDays} ngày)
- Ngày mục tiêu cần dự báo số dư: Ngày ${ctx.timeframe.targetDateFormatted} (${ctx.timeframe.forecastDays} ngày tính từ thời điểm phân tích)

DỮ LIỆU THỰC TẾ TRONG KHOẢNG PHÂN TÍCH (${ctx.timeframe.analysisDays} NGÀY):
- Tổng số giao dịch: ${ctx.stats.txCount} giao dịch
- Tổng chi tiêu sinh hoạt thực tế (Expense - ĐÃ LOẠI TRỪ CÁC KHOẢN CHO VAY): ${(ctx.stats.livingExpense ?? ctx.stats.totalExpense).toLocaleString('vi-VN')} VND (bình quân tiêu hao sinh hoạt thực tế ${ctx.stats.dailyExpenseAvg.toLocaleString('vi-VN')} VND/ngày)
- Tổng thu nhập thực tế (Income - ĐÃ LOẠI TRỪ THU HỒI NỢ): ${(ctx.stats.livingIncome ?? ctx.stats.totalIncome).toLocaleString('vi-VN')} VND (bình quân ${ctx.stats.dailyIncomeAvg.toLocaleString('vi-VN')} VND/ngày)
${ctx.stats.debtLentTotal > 0 ? `- Tổng khoản tiền Cho vay trong kỳ (TÁCH RIÊNG CÔNG NỢ, KHÔNG TÍNH CHI TIÊU SINH HOẠT): ${ctx.stats.debtLentTotal.toLocaleString('vi-VN')} VND\n` : ''}${ctx.stats.debtRecoveredTotal > 0 ? `- Tổng khoản Thu hồi nợ trong kỳ (TÁCH RIÊNG CÔNG NỢ, KHÔNG TÍNH THU NHẬP SINH HOẠT): ${ctx.stats.debtRecoveredTotal.toLocaleString('vi-VN')} VND\n` : ''}- Thâm hụt ròng sinh hoạt (Net Burn): ${ctx.stats.netBurn.toLocaleString('vi-VN')} VND (bình quân tiêu hao ròng: ${ctx.stats.dailyNetBurnAvg.toLocaleString('vi-VN')} VND/ngày)
- Hạn mức chi tiêu sinh hoạt an toàn tối đa mỗi ngày tới ngày mục tiêu (sau khi đã tính các khoản chi cố định sắp tới): ${ctx.stats.safeDailySpendingAllowance.toLocaleString('vi-VN')} VND/ngày
- Thu nhập dự kiến nhận thêm trước ngày mục tiêu: ${ctx.expectedIncome > 0 ? `${ctx.expectedIncome.toLocaleString('vi-VN')} VND` : '0 VND'}
* NGUYÊN TẮC QUAN TRỌNG: Khoản 'Cho vay' là luân chuyển tài sản công nợ tạm thời, TUYỆT ĐỐI KHÔNG coi là chi tiêu sinh hoạt hay tốc độ đốt tiền tiêu dùng. Thu hồi nợ cũng không được tính là thu nhập đều đặn.

CÁC KHOẢN DỰ KIẾN SẮP TỚI NGƯỜI DÙNG ĐÃ CHỌN (UPCOMING PLANNED ITEMS):
* Khoản chi dự kiến (Định kỳ, hóa đơn, sự kiện sắp tới): Tổng cộng: ${ctx.upcoming?.totalExpenses?.toLocaleString('vi-VN') || 0} VND
${upcomingExpensesText}
* Khoản thu dự kiến khác sắp tới: Tổng cộng: ${ctx.upcoming?.totalIncomes?.toLocaleString('vi-VN') || 0} VND
${upcomingIncomesText}

BÁO CÁO HẠNG MỤC THU CHI & TÌNH HÌNH THỰC HIỆN NGÂN SÁCH ĐÃ THIẾT LẬP:
${
  ctx.categoryReport && ctx.categoryReport.length > 0
    ? ctx.categoryReport
        .map(
          (c: any) =>
            `- ${c.name}: Thực chi ${c.spent.toLocaleString('vi-VN')} VND (${c.percentOfTotal}% tổng chi, ${c.count} giao dịch, bình quân ${c.dailyAverage.toLocaleString('vi-VN')} VND/ngày)${
              c.budgetAmount > 0
                ? ` | Hạn mức ngân sách: ${c.budgetAmount.toLocaleString('vi-VN')} VND (Đã dùng ${c.percentOfBudget}%, Trạng thái: ${c.status})`
                : ' | Chưa đặt hạn mức ngân sách'
            }`,
        )
        .join('\n')
    : '- Không có giao dịch chi tiêu trong khoảng thời gian này.'
}

CÁC KHOẢN CHI LỚN ĐÃ CHI TRONG QUÁ KHỨ ĐÁNG CHÚ Ý:
${
  ctx.anomalies.length > 0
    ? ctx.anomalies
        .map(
          (a: any) =>
            `- Ngày ${a.date}: ${a.amount.toLocaleString('vi-VN')} VND - "${a.description}" (Danh mục: ${a.categoryName})`,
        )
        .join('\n')
    : '- Không có khoản chi lớn đột xuất trong kỳ phân tích.'
}

KẾT QUẢ TÍNH TOÁN DỰ BÁO ĐẾN NGÀY ${ctx.timeframe.targetDateFormatted} (ĐÃ BAO GỒM CÁC KHOẢN DỰ KIẾN SẮP TỚI):
- Kịch bản thực tế (Duy trì tốc độ chi hiện tại + các khoản dự kiến sắp tới): Tiêu hao thêm ${ctx.projections.baseline.projectedExpense.toLocaleString('vi-VN')} VND -> Số dư trước khoản thu thêm: ${ctx.projections.baseline.projectedBalanceBeforeSalary.toLocaleString('vi-VN')} VND (Sau khoản thu thêm: ${ctx.projections.baseline.projectedBalanceAfterSalary.toLocaleString('vi-VN')} VND).
- Kịch bản tối ưu (Tiết kiệm chi tiêu sinh hoạt, kiểm soát chặt + các khoản dự kiến sắp tới): Tiêu hao thêm ${ctx.projections.optimized.projectedExpense.toLocaleString('vi-VN')} VND -> Số dư trước khoản thu thêm: ${ctx.projections.optimized.projectedBalanceBeforeSalary.toLocaleString('vi-VN')} VND (Sau khoản thu thêm: ${ctx.projections.optimized.projectedBalanceAfterSalary.toLocaleString('vi-VN')} VND).
- Kịch bản thận trọng (Chi nhiều dịp cuối kỳ + các khoản dự kiến sắp tới): Số dư trước khoản thu thêm: ${ctx.projections.conservative.projectedBalanceBeforeSalary.toLocaleString('vi-VN')} VND.

YÊU CẦU ĐẦU RA:
Trả về duy nhất 1 JSON object hợp lệ (không kèm text ngoài JSON) theo cấu trúc:
{
  "summary": "1-2 câu tóm tắt sắc sảo, đánh giá sức khỏe dòng tiền của giai đoạn đã chọn và áp lực thanh toán sắp tới",
  "projectionAssessment": "Đánh giá chi tiết về số dư dự kiến đến ngày ${ctx.timeframe.targetDateFormatted}, đặc biệt lưu ý khả năng chi trả các khoản cam kết sắp tới",
  "customAnswer": "${ctx.customQuestion ? 'Câu trả lời chi tiết, thực tế và sâu sắc cho câu hỏi của người dùng' : ''}",
  "keyObservations": [
    "Nhận xét sắc bén 1 về cơ cấu chi phí hoặc khoản chi bất thường",
    "Nhận xét sắc bén 2 về tác động của các khoản sắp tới tới số dư thực tế",
    "Nhận xét sắc bén 3 về thói quen chi tiêu hàng ngày và tính thanh khoản"
  ],
  "recommendations": [
    "Khuyên 1: Hạn mức ngân sách tối đa nên giữ mỗi ngày cho ${ctx.timeframe.forecastDays} ngày tới sau khi để dành tiền cho các khoản sắp tới",
    "Khuyên 2: Phương án chuẩn bị tiền cho ngày đến hạn chi tiêu lớn",
    "Khuyên 3: Kế hoạch phân bổ dòng tiền khi đến ngày mục tiêu ${ctx.timeframe.targetDateFormatted}"
  ],
  "verdict": "AN_TOAN" | "CAN_CHU_Y" | "NGUY_CO"
}
`;
  }

  private parseJsonSafe(text: string): any {
    try {
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
    const isHealthy = ctx.projections.baseline.projectedBalanceBeforeSalary > 2000000;
    const upcomingExp = ctx.upcoming?.totalExpenses || 0;
    return {
      summary: `Trong ${ctx.timeframe.analysisDays} ngày qua, tốc độ tiêu hao ròng là ${ctx.stats.dailyNetBurnAvg.toLocaleString('vi-VN')} đ/ngày. ${upcomingExp > 0 ? `Các khoản dự kiến sắp tới là ${upcomingExp.toLocaleString('vi-VN')} đ. ` : ''}Số dư hiện tại ${ctx.account.balance.toLocaleString('vi-VN')} đ ${isHealthy ? 'đủ duy trì an toàn' : 'cần kiểm soát chặt chẽ'} cho ${ctx.timeframe.forecastDays} ngày tiếp theo.`,
      projectionAssessment: `Dự báo đến ngày ${ctx.timeframe.targetDateFormatted}, sau khi trừ chi tiêu sinh hoạt và các khoản dự kiến sắp tới (${upcomingExp.toLocaleString('vi-VN')} đ), tài khoản ước tính còn khoảng ${ctx.projections.baseline.projectedBalanceBeforeSalary.toLocaleString('vi-VN')} đ (chưa tính khoản thu thêm) và khoảng ${ctx.projections.baseline.projectedBalanceAfterSalary.toLocaleString('vi-VN')} đ nếu có thu nhập dự kiến.`,
      customAnswer: ctx.customQuestion
        ? `Dựa trên dữ liệu tài chính của bạn (số dư ${ctx.account.balance.toLocaleString('vi-VN')} đ, chi dự kiến sắp tới ${upcomingExp.toLocaleString('vi-VN')} đ, chi sinh hoạt ~${ctx.stats.dailyNetBurnAvg.toLocaleString('vi-VN')} đ/ngày), bạn nên ưu tiên giữ số dư cho các khoản cam kết thiết yếu trước.`
        : undefined,
      keyObservations: [
        upcomingExp > 0
          ? `Tổng các khoản chi dự kiến sắp tới (tiền nhà, quà, hóa đơn) là ${upcomingExp.toLocaleString('vi-VN')} đ, chiếm ${(ctx.account.balance > 0 ? Math.round((upcomingExp / ctx.account.balance) * 100) : 0)}% số dư hiện có.`
          : 'Không có khoản chi đột xuất lớn được lên lịch trước.',
        `Danh mục chiếm tỷ trọng cao nhất trong quá khứ là ${ctx.categories[0]?.name || 'Chi tiêu chính'} (${ctx.categories[0]?.percent || 0}%).`,
        `Hạn mức chi tiêu sinh hoạt an toàn mỗi ngày đến ngày ${ctx.timeframe.targetDateFormatted} là ${ctx.stats.safeDailySpendingAllowance.toLocaleString('vi-VN')} đ/ngày.`,
      ],
      recommendations: [
        `Giữ ngân sách sinh hoạt hàng ngày không quá ${ctx.stats.safeDailySpendingAllowance.toLocaleString('vi-VN')} đ/ngày để luôn sẵn sàng tiền thanh toán các khoản sắp tới.`,
        'Kiểm soát và hạn chế phát sinh mua sắm ngoài danh mục kế hoạch.',
        `Sau khi thanh toán các khoản nghĩa vụ và đến ngày ${ctx.timeframe.targetDateFormatted}, hãy trích ngay một phần vào quỹ tích lũy khẩn cấp.`,
      ],
      verdict: isHealthy ? 'AN_TOAN' : 'CAN_CHU_Y',
      modelUsed: `Local Heuristic Engine (${reason})`,
      generatedAt: new Date().toISOString(),
    };
  }
}
