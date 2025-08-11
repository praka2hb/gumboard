import { auth } from "@/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { organizationId } = await request.json()

    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 })
    }

    // Verify user is a member of this organization
    const membership = await db.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: organizationId
        }
      }
    })

    if (!membership) {
      return NextResponse.json({ error: "You are not a member of this organization" }, { status: 403 })
    }

    // Update current organization
    await db.user.update({
      where: { id: session.user.id },
      data: { organizationId: organizationId, isAdmin: membership.isAdmin }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error("Error switching organization:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
