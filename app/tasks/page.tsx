'use client';

import { useEffect, useState } from 'react';
import { Task } from '@/packages/shared/types';
import { CheckSquare, Play, Check, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const electron = typeof window !== 'undefined' ? (window as any).electron : null;

  useEffect(() => {
    const loadTasks = async () => {
      if (electron) {
        const tsks = await electron.tasks.getTasks();
        setTasks(tsks);
      }
    };
    loadTasks();
  }, [electron]);

  const handleUpdateStatus = async (taskId: string, status: string) => {
    if (!electron) return;
    await electron.cmd.execute('updateTaskStatus', { taskId, status });
    const tsks = await electron.tasks.getTasks();
    setTasks(tsks);
  };

  return (
    <div className="p-8 h-full overflow-y-auto">
      <h1 className="text-2xl font-semibold tracking-tight mb-8">Task Queue</h1>
      
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-zinc-500 uppercase bg-zinc-950/50 border-b border-zinc-800">
            <tr>
              <th className="px-6 py-3 font-medium">Task</th>
              <th className="px-6 py-3 font-medium">Type</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Priority</th>
              <th className="px-6 py-3 font-medium">Created</th>
              <th className="px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {tasks.map((task) => (
              <tr key={task.id} className="hover:bg-zinc-800/50 transition-colors">
                <td className="px-6 py-4 font-medium text-zinc-200">
                  {task.title}
                  {task.escalationReason && (
                    <div className="text-xs text-red-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {task.escalationReason}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-zinc-400">{task.type}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wider ${
                    task.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                    task.status === 'in-progress' ? 'bg-blue-500/10 text-blue-400' :
                    'bg-zinc-800 text-zinc-300'
                  }`}>
                    {task.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wider ${
                    task.priority === 'high' ? 'bg-red-500/10 text-red-400' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {task.priority}
                  </span>
                </td>
                <td className="px-6 py-4 text-zinc-500">{format(new Date(task.createdAt), 'MMM d')}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {task.status !== 'in-progress' && task.status !== 'completed' && (
                      <button 
                        onClick={() => handleUpdateStatus(task.id, 'in-progress')}
                        className="p-1.5 text-zinc-400 hover:text-blue-400 hover:bg-zinc-700 rounded transition-colors" 
                        title="Start"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    {task.status !== 'completed' && (
                      <button 
                        onClick={() => handleUpdateStatus(task.id, 'completed')}
                        className="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-700 rounded transition-colors" 
                        title="Complete"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                  No tasks found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
