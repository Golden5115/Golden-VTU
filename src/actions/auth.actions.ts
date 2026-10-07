"use server"

import prisma from "@/lib/prisma"
import bcrypt from "bcrypt"
import { normalizePhoneNumber } from "@/lib/phone-utils"

export interface SignUpResponse {
  success: boolean
  error?: string
}

export async function signUpUser(formData: {
  name: string
  email: string
  phone?: string
  password: string
}): Promise<SignUpResponse> {
  try {
    const name = formData.name?.trim()
    const email = formData.email?.trim().toLowerCase()
    const password = formData.password?.trim()
    const rawPhone = formData.phone?.trim()

    if (!name || name.length < 2) {
      return { success: false, error: "Please enter your full name." }
    }

    if (!email || !email.includes("@")) {
      return { success: false, error: "Please provide a valid email address." }
    }

    if (!password || password.length < 6) {
      return { success: false, error: "Password must be at least 6 characters long." }
    }

    let phone: string | null = null
    if (rawPhone) {
      const clean = normalizePhoneNumber(rawPhone)
      if (clean.length === 11) {
        phone = clean
      } else {
        return { success: false, error: "Please enter a valid 11-digit Nigerian phone number." }
      }
    }

    // 1. Check if email is already taken
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    })
    if (existingEmail) {
      return { success: false, error: "An account with this email already exists. Please sign in." }
    }

    // 2. Check if phone is already taken (if provided)
    if (phone) {
      const existingPhone = await prisma.user.findFirst({
        where: { phone },
      })
      if (existingPhone) {
        return { success: false, error: "An account with this phone number already exists." }
      }
    }

    // 3. Hash the password securely
    const hashedPassword = await bcrypt.hash(password, 10)

    // 4. Create new user
    await prisma.user.create({
      data: {
        name,
        email,
        phone,
        password: hashedPassword,
        role: "USER",
        walletBalance: 0.0,
      },
    })

    return { success: true }
  } catch (error: any) {
    console.error("[SignUpAction] Error:", error)
    return { success: false, error: error.message || "Failed to create account. Please try again." }
  }
}
