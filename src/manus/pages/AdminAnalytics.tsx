import { useEffect, useState } from "react";
import { trpc } from "@/manus/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Loader2 } from "lucide-react";

export default function AdminAnalytics() {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  // Analytics queries
  const overviewQuery = trpc.analytics.overview.useQuery();
  const allUsersQuery = trpc.analytics.allUsers.useQuery();
  const accessQuery = trpc.analytics.access.useQuery();
  const revenueQuery = trpc.analytics.revenue.useQuery();
  const userAnalyticsQuery = trpc.analytics.user.useQuery(
    { userId: selectedUserId! },
    { enabled: selectedUserId !== null }
  );

  const COLORS = ["#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444"];

  if (overviewQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  const overview = overviewQuery.data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Admin Analytics Dashboard</h1>
          <p className="text-slate-600">Real-time platform metrics and user analytics</p>
        </div>

        {/* Overview Cards */}
        {overview && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-white shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Total Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">{overview.totalUsers}</div>
                <p className="text-xs text-slate-500 mt-1">{overview.activeMembers} active members</p>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">${overview.totalRevenue.toFixed(2)}</div>
                <p className="text-xs text-slate-500 mt-1">{overview.totalPurchases} purchases</p>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Active Members</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">{overview.activeMembers}</div>
                <p className="text-xs text-slate-500 mt-1">
                  {overview.totalUsers > 0 ? ((overview.activeMembers / overview.totalUsers) * 100).toFixed(1) : 0}% conversion
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Avg Revenue per User</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">
                  ${overview.totalUsers > 0 ? (overview.totalRevenue / overview.totalUsers).toFixed(2) : "0.00"}
                </div>
                <p className="text-xs text-slate-500 mt-1">Lifetime value</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs for different analytics views */}
        <Tabs defaultValue="revenue" className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-8">
            <TabsTrigger value="revenue">Revenue Analytics</TabsTrigger>
            <TabsTrigger value="access">Access Analytics</TabsTrigger>
            <TabsTrigger value="users">User Analytics</TabsTrigger>
            <TabsTrigger value="user-detail">User Details</TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
          </TabsList>

          {/* Revenue Analytics Tab */}
          <TabsContent value="revenue" className="space-y-6">
            {revenueQuery.isLoading ? (
              <div className="flex justify-center items-center h-96">
                <Loader2 className="animate-spin" />
              </div>
            ) : revenueQuery.data ? (
              <>
                {/* Daily Revenue Chart */}
                <Card className="bg-white shadow-lg">
                  <CardHeader>
                    <CardTitle>Daily Revenue (Last 30 Days)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={revenueQuery.data.dailyRevenue}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" allowDecimals={false} />
                        <Tooltip formatter={(value, name) => name === "Purchases" ? value : `$${value}`} />
                        <Legend />
                        <Line type="monotone" dataKey="total" stroke="#8b5cf6" name="Revenue ($)" yAxisId="left" />
                        <Line type="monotone" dataKey="count" stroke="#ec4899" name="Purchases" yAxisId="right" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Revenue by Type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="bg-white shadow-lg">
                    <CardHeader>
                      <CardTitle>Revenue by Purchase Type</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={revenueQuery.data.revenueByType}
                            dataKey="total"
                            nameKey="type"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label
                          >
                            {(revenueQuery.data?.revenueByType ?? []).map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => `$${value}`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="bg-white shadow-lg">
                    <CardHeader>
                      <CardTitle>Membership Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={revenueQuery.data.membershipDistribution}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="tier" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" fill="#8b5cf6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : null}
          </TabsContent>

          {/* Access Analytics Tab */}
          <TabsContent value="access" className="space-y-6">
            {accessQuery.isLoading ? (
              <div className="flex justify-center items-center h-96">
                <Loader2 className="animate-spin" />
              </div>
            ) : accessQuery.data ? (
              <>
                {/* Daily Active Users */}
                <Card className="bg-white shadow-lg">
                  <CardHeader>
                    <CardTitle>Daily Active Users (Last 30 Days)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={accessQuery.data.dailyActiveUsers}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="count" stroke="#10b981" name="Active Users" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Activity by Type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="bg-white shadow-lg">
                    <CardHeader>
                      <CardTitle>Activity by Type</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={accessQuery.data.activityByType}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="type" angle={-45} textAnchor="end" height={100} />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" fill="#3b82f6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="bg-white shadow-lg">
                    <CardHeader>
                      <CardTitle>Most Accessed Modules</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {(accessQuery.data?.mostAccessedModules ?? []).map((module, idx) => (
                          <div key={idx} className="flex justify-between items-center">
                            <span className="text-sm text-slate-600">Module {module.moduleId}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-32 bg-slate-200 rounded-full h-2">
                                <div
                                  className="bg-purple-500 h-2 rounded-full"
                                  style={{
                                    width: `${(module.count / (accessQuery.data?.mostAccessedModules[0]?.count || 1)) * 100}%`,
                                  }}
                                />
                              </div>
                              <span className="text-sm font-semibold text-slate-900 w-12 text-right">{module.count}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : null}
          </TabsContent>

          {/* User Analytics Tab */}
          <TabsContent value="users" className="space-y-6">
            {allUsersQuery.isLoading ? (
              <div className="flex justify-center items-center h-96">
                <Loader2 className="animate-spin" />
              </div>
            ) : allUsersQuery.data ? (
              <Card className="bg-white shadow-lg overflow-hidden">
                <CardHeader>
                  <CardTitle>All Users Analytics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700">Email</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700">Membership</th>
                          <th className="px-4 py-3 text-center font-semibold text-slate-700">Purchases</th>
                          <th className="px-4 py-3 text-center font-semibold text-slate-700">Spent</th>
                          <th className="px-4 py-3 text-center font-semibold text-slate-700">Lessons</th>
                          <th className="px-4 py-3 text-center font-semibold text-slate-700">Quizzes</th>
                          <th className="px-4 py-3 text-center font-semibold text-slate-700">Avg Score</th>
                          <th className="px-4 py-3 text-center font-semibold text-slate-700">Certificates</th>
                          <th className="px-4 py-3 text-center font-semibold text-slate-700">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {(allUsersQuery.data ?? []).map((user) => (
                          <tr key={user.id} className="hover:bg-slate-50 transition">
                            <td className="px-4 py-3 text-slate-900 font-medium">{user.name || "N/A"}</td>
                            <td className="px-4 py-3 text-slate-600 text-xs">{user.email}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                                {user.membershipTier}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-slate-900">{user.purchases}</td>
                            <td className="px-4 py-3 text-center text-slate-900 font-semibold">${user.totalSpent}</td>
                            <td className="px-4 py-3 text-center text-slate-900">{user.lessonsAccessed}</td>
                            <td className="px-4 py-3 text-center text-slate-900">{user.quizzesCompleted}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                {user.averageQuizScore}%
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-slate-900">{user.certificatesEarned}</td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => setSelectedUserId(user.id)}
                                className="text-purple-600 hover:text-purple-700 font-medium text-xs"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          {/* User Detail Tab */}
          <TabsContent value="user-detail" className="space-y-6">
            {selectedUserId === null ? (
              <Card className="bg-white shadow-lg">
                <CardContent className="pt-6">
                  <p className="text-slate-600 text-center">Select a user from the User Analytics tab to view details</p>
                </CardContent>
              </Card>
            ) : userAnalyticsQuery.isLoading ? (
              <div className="flex justify-center items-center h-96">
                <Loader2 className="animate-spin" />
              </div>
            ) : userAnalyticsQuery.data ? (
              <>
                {/* User Header */}
                <Card className="bg-white shadow-lg">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-2xl">{userAnalyticsQuery.data.user.name}</CardTitle>
                        <p className="text-slate-600 text-sm mt-1">{userAnalyticsQuery.data.user.email}</p>
                      </div>
                      <button
                        onClick={() => setSelectedUserId(null)}
                        className="text-slate-500 hover:text-slate-700 font-medium"
                      >
                        ✕
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-slate-600 font-medium">Membership</p>
                        <p className="text-lg font-semibold text-slate-900">{userAnalyticsQuery.data.user.membershipTier}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 font-medium">Joined</p>
                        <p className="text-lg font-semibold text-slate-900">
                          {new Date(userAnalyticsQuery.data.user.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 font-medium">Purchases</p>
                        <p className="text-lg font-semibold text-slate-900">{userAnalyticsQuery.data.purchases.length}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 font-medium">Total Spent</p>
                        <p className="text-lg font-semibold text-slate-900">
                          ${userAnalyticsQuery.data.purchases.reduce((sum, p) => sum + parseFloat(p.amount), 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Purchase History */}
                {userAnalyticsQuery.data.purchases.length > 0 && (
                  <Card className="bg-white shadow-lg">
                    <CardHeader>
                      <CardTitle>Purchase History</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {(userAnalyticsQuery.data?.purchases ?? []).map((purchase, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded">
                            <div>
                              <p className="font-medium text-slate-900">{purchase.purchaseType}</p>
                              <p className="text-xs text-slate-600">{new Date(purchase.createdAt).toLocaleDateString()}</p>
                            </div>
                            <p className="font-semibold text-slate-900">${purchase.amount}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Learning Progress */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="bg-white shadow-lg">
                    <CardHeader>
                      <CardTitle>Learning Progress</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-sm text-slate-600 font-medium">Lessons Accessed</p>
                        <p className="text-2xl font-bold text-slate-900">{userAnalyticsQuery.data.lessonAccessCount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600 font-medium">Quizzes Completed</p>
                        <p className="text-2xl font-bold text-slate-900">{userAnalyticsQuery.data.quizResults.length}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600 font-medium">Certificates Earned</p>
                        <p className="text-2xl font-bold text-slate-900">{userAnalyticsQuery.data.certificates}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white shadow-lg">
                    <CardHeader>
                      <CardTitle>Quiz Results by Module</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {(userAnalyticsQuery.data?.quizResults ?? []).length > 0 ? (
                          (userAnalyticsQuery.data?.quizResults ?? []).map((result, idx) => (
                            <div key={idx} className="flex justify-between items-center">
                              <span className="text-sm text-slate-600">Module {result.moduleId}</span>
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  result.passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                }`}
                              >
                                {result.scorePercentage}%
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-600">No quiz results yet</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Activity */}
                {(userAnalyticsQuery.data?.activityLog ?? []).length > 0 && (
                  <Card className="bg-white shadow-lg">
                    <CardHeader>
                      <CardTitle>Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {(userAnalyticsQuery.data?.activityLog ?? []).map((activity, idx) => (
                          <div key={idx} className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded">
                            <span className="text-slate-600">{activity.activityType}</span>
                            <span className="text-xs text-slate-500">
                              {new Date(activity.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : null}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
