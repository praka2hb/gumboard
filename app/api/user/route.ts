import { auth } from "@/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user with current organization and all memberships
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: { 
        organization: {
          include: {
            members: {
              select: {
                id: true,
                name: true,
                email: true,
                isAdmin: true
              }
            }
          }
        },
        organizationMemberships: {
          include: {
            organization: true
          },
          orderBy: {
            joinedAt: 'desc'
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      organization: user.organization ? {
        id: user.organization.id,
        name: user.organization.name,
        slackWebhookUrl: user.organization.slackWebhookUrl,
        members: user.organization.members
      } : null,
      // Include all organizations user is a member of
      organizations: user.organizationMemberships.map(membership => ({
        id: membership.organization.id,
        name: membership.organization.name,
        isAdmin: membership.isAdmin,
        joinedAt: membership.joinedAt,
        isCurrent: membership.organizationId === user.organizationId
      }))
    })
  } catch (error) {
    console.error("Error fetching user:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
} 