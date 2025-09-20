// App.js
import React, { useState, useEffect } from "react";
import Header from "./header"; // Make sure you actually have Header.js

function App() {
  const [tasks, setTasks] = useState([]);
  const [prod, setProd] = useState("—");
  const [press, setPress] = useState("—");
  const [heatmap, setHeatmap] = useState([]);

  // add task
  const addTask = (e) => {
    e.preventDefault();
    const cmd = e.target.taskCommand.value;
    const time = e.target.taskTime.value;
    const priority = e.target.taskPriority.value;
    const frequency = e.target.taskFrequency.value;
    if (!cmd || !time) return;

    const newTask = { command: cmd, time, priority, frequency };
    setTasks([...tasks, newTask]);
    e.target.reset();
  };

  // delete task
  const deleteTask = (i) => {
    setTasks(tasks.filter((_, idx) => idx !== i));
  };

  // compute stats + heatmap whenever tasks change
  useEffect(() => {
    if (tasks.length > 0) {
      setProd((Math.random() * 10).toFixed(1));
      setPress(Math.round(Math.random() * 100) + "%");
    } else {
      setProd("—");
      setPress("—");
    }

    // dummy heatmap
    const cells = Array.from({ length: 24 }, () => Math.random() * 0.9 + 0.1);
    setHeatmap(cells);
  }, [tasks]);

  return (
    <div>
      <Header />
      <main className="p-4">
        {/* Task Form */}
        <form onSubmit={addTask} className="space-x-2 mb-4">
          <input type="text" id="taskCommand" name="taskCommand" placeholder="Command" required />
          <input type="time" id="taskTime" name="taskTime" required />
          <input type="text" id="taskPriority" name="taskPriority" placeholder="Priority" />
          <input type="text" id="taskFrequency" name="taskFrequency" placeholder="Frequency" />
          <button type="submit">Add Task</button>
        </form>

        {/* Task Table */}
        <table border="1" cellPadding="6" className="app-table">
          <thead>
            <tr>
              <th>Command</th>
              <th>Time</th>
              <th>Priority</th>
              <th>Frequency</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan="5" className="app-no-tasks">
                  No tasks yet
                </td>
              </tr>
            ) : (
              tasks.map((t, i) => (
                <tr key={i}>
                  <td>{t.command}</td>
                  <td>{t.time}</td>
                  <td>{t.priority}</td>
                  <td>{t.frequency}</td>
                  <td>
                    <button onClick={() => deleteTask(i)}>❌</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Stats */}
        <div>
          <p>Productivity: <b>{prod}</b></p>
          <p>Pressure: <b>{press}</b></p>
        </div>

        {/* Heatmap */}
        <div id="heatmap" className="app-heatmap">
          {heatmap.map((opacity, i) => (
            <div key={i} className="app-heatmap-cell" data-opacity={opacity}></div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default App;
