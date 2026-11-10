import { z } from "zod";

function passesLuhn(number: string): boolean {
    let sum = 0;
    let doubleDigit = false;
    for (let index = number.length - 1; index >= 0; index -= 1) {
        let digit = Number(number[index]);
        if (doubleDigit) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        doubleDigit = !doubleDigit;
    }
    return sum % 10 === 0;
}

export const paymentSchema = z
    .strictObject({
        cardholderName: z
            .string()
            .trim()
            .min(2, "Enter the cardholder name")
            .max(100),
        cardNumber: z
            .string()
            .regex(/^\d{16}$/, "Enter a 16-digit card number")
            .refine(passesLuhn, "Enter a valid card number"),
        expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Use MM/YY"),
        cvc: z.string().regex(/^\d{3,4}$/, "Enter a 3- or 4-digit CVC"),
    })
    .superRefine(({ expiry }, context) => {
        if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) return;
        const [monthText, yearText] = expiry.split("/");
        const month = Number(monthText);
        const year = 2000 + Number(yearText);
        const now = new Date();
        if (
            year < now.getFullYear() ||
            (year === now.getFullYear() && month < now.getMonth() + 1)
        ) {
            context.addIssue({
                code: "custom",
                path: ["expiry"],
                message: "Card expiry must be in the future",
            });
        }
    });

export type PaymentInput = z.infer<typeof paymentSchema>;
