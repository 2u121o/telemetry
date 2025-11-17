import tkinter as tk
from tkinter import ttk, filedialog, messagebox

import pandas as pd
import numpy as np
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.figure import Figure


class DataModel:
    """
    Central data storage: original and processed DataFrames.
    """
    def __init__(self):
        self.original_df = None
        self.processed_df = None

    def load_file(self, path, delimiter=None):
        if delimiter is None:
            df = pd.read_csv(path, sep=None, engine="python")
        else:
            df = pd.read_csv(path, sep=delimiter, engine="python")

        # Normalize column names
        df.columns = df.columns.str.strip()

        self.original_df = df
        self.processed_df = df.copy()

    def get_df(self):
        if self.processed_df is None:
            raise RuntimeError("No data loaded.")
        return self.processed_df

    def get_columns(self):
        return list(self.get_df().columns)


class XYPlotVisualizer(tk.Frame):
    """
    XY plot viewer using matplotlib.
    - Lets the user choose X and Y columns.
    - Emits timestamp selection when user clicks on the plot.
    """
    def __init__(self, master, app, **kwargs):
        super().__init__(master, **kwargs)
        self.app = app
        self.df = None

        self.x_var = tk.StringVar()
        self.y_var = tk.StringVar()

        self._build_ui()

        self.fig = Figure(figsize=(5, 4))
        self.ax = self.fig.add_subplot(111)
        self.canvas = FigureCanvasTkAgg(self.fig, master=self.plot_frame)
        self.canvas_widget = self.canvas.get_tk_widget()
        self.canvas_widget.pack(fill=tk.BOTH, expand=True)

        self.line = None
        self.cursor_line = None

        # Connect matplotlib event
        self.canvas.mpl_connect("button_press_event", self._on_click)

    def _build_ui(self):
        control_frame = tk.Frame(self)
        control_frame.pack(side=tk.TOP, fill=tk.X)

        tk.Label(control_frame, text="X:").pack(side=tk.LEFT)
        self.x_combo = ttk.Combobox(control_frame, textvariable=self.x_var, state="readonly")
        self.x_combo.pack(side=tk.LEFT, padx=5)

        tk.Label(control_frame, text="Y:").pack(side=tk.LEFT)
        self.y_combo = ttk.Combobox(control_frame, textvariable=self.y_var, state="readonly")
        self.y_combo.pack(side=tk.LEFT, padx=5)

        plot_btn = tk.Button(control_frame, text="Plot", command=self.plot)
        plot_btn.pack(side=tk.LEFT, padx=5)

        self.plot_frame = tk.Frame(self)
        self.plot_frame.pack(side=tk.TOP, fill=tk.BOTH, expand=True)

    def set_data(self, df: pd.DataFrame):
        """
        Receive the DataFrame from the app and update available columns.
        """
        self.df = df
        cols = list(df.columns)
        self.x_combo["values"] = cols
        self.y_combo["values"] = cols

        # Try some defaults if present
        if "timestamp" in cols:
            self.x_var.set("timestamp")
        if "ax" in cols:
            self.y_var.set("ax")

    def plot(self):
        if self.df is None:
            messagebox.showwarning("No data", "No data loaded.")
            return

        x_col = self.x_var.get()
        y_col = self.y_var.get()

        if x_col not in self.df.columns or y_col not in self.df.columns:
            messagebox.showwarning("Invalid selection", "Please choose valid X and Y columns.")
            return

        x = self.df[x_col]
        y = self.df[y_col]

        self.ax.clear()
        self.line, = self.ax.plot(x, y, label=f"{y_col} vs {x_col}")
        self.ax.set_xlabel(x_col)
        self.ax.set_ylabel(y_col)
        self.ax.grid(True)
        self.ax.legend()

        # Remove previous cursor line if any
        self.cursor_line = None

        self.canvas.draw()

    def _on_click(self, event):
        """
        Handle mouse click on the plot.
        Emits the selected timestamp (based on X axis).
        """
        if self.df is None:
            return
        if event.inaxes != self.ax:
            return
        if event.xdata is None:
            return

        # Interpret X axis as timestamp-like value
        selected_x = event.xdata

        # We assume the X column is "timestamp" or time-like
        x_col = self.x_var.get()
        if x_col not in self.df.columns:
            return

        t = self.df[x_col].to_numpy()
        # Find nearest timestamp
        idx = (np.abs(t - selected_x)).argmin()
        ts_nearest = t[idx]

        # Notify the app so other viewers can sync
        self.app.notify_timestamp_selected(ts_nearest)

        # Draw a vertical cursor line at the selected position
        self._update_cursor_line(ts_nearest)

    def _update_cursor_line(self, ts_value):
        """
        Draw or move a vertical line at the given X (timestamp) position.
        """
        if self.line is None:
            return

        # Get current y-limits
        ymin, ymax = self.ax.get_ylim()

        if self.cursor_line is None:
            self.cursor_line = self.ax.axvline(ts_value, color="red", linestyle="--")
        else:
            self.cursor_line.set_xdata([ts_value, ts_value])
            self.cursor_line.set_ydata([ymin, ymax])

        self.canvas.draw_idle()

    def on_timestamp_selected(self, ts_value):
        """
        Called by the app when another viewer selects a timestamp.
        We move the cursor line accordingly (if X axis is time).
        """
        x_col = self.x_var.get()
        if self.df is None or x_col not in self.df.columns:
            return

        # Simply place a vertical line at ts_value in X axis coordinates
        self._update_cursor_line(ts_value)


class MapVisualizer(tk.Frame):
    """
    Simple 2D map-like viewer for latitude/longitude.
    Uses a scatter plot: lon on X, lat on Y.
    Synchronizes with timestamp: highlights the point corresponding to the selected timestamp.
    """
    def __init__(self, master, app, **kwargs):
        super().__init__(master, **kwargs)
        self.app = app
        self.df = None

        self.lat_col_var = tk.StringVar(value="lat")
        self.lon_col_var = tk.StringVar(value="lon")
        self.time_col_var = tk.StringVar(value="timestamp")

        self._build_ui()

        self.fig = Figure(figsize=(5, 4))
        self.ax = self.fig.add_subplot(111)
        self.canvas = FigureCanvasTkAgg(self.fig, master=self.plot_frame)
        self.canvas_widget = self.canvas.get_tk_widget()
        self.canvas_widget.pack(fill=tk.BOTH, expand=True)

        self.scatter = None
        self.current_point = None

    def _build_ui(self):
        control_frame = tk.Frame(self)
        control_frame.pack(side=tk.TOP, fill=tk.X)

        tk.Label(control_frame, text="Lat:").pack(side=tk.LEFT)
        self.lat_combo = ttk.Combobox(control_frame, textvariable=self.lat_col_var, state="readonly")
        self.lat_combo.pack(side=tk.LEFT, padx=5)

        tk.Label(control_frame, text="Lon:").pack(side=tk.LEFT)
        self.lon_combo = ttk.Combobox(control_frame, textvariable=self.lon_col_var, state="readonly")
        self.lon_combo.pack(side=tk.LEFT, padx=5)

        tk.Label(control_frame, text="Time:").pack(side=tk.LEFT)
        self.time_combo = ttk.Combobox(control_frame, textvariable=self.time_col_var, state="readonly")
        self.time_combo.pack(side=tk.LEFT, padx=5)

        plot_btn = tk.Button(control_frame, text="Plot map", command=self.plot)
        plot_btn.pack(side=tk.LEFT, padx=5)

        self.plot_frame = tk.Frame(self)
        self.plot_frame.pack(side=tk.TOP, fill=tk.BOTH, expand=True)

    def set_data(self, df: pd.DataFrame):
        """
        Receive DataFrame from app and update column lists.
        """
        self.df = df
        cols = list(df.columns)
        self.lat_combo["values"] = cols
        self.lon_combo["values"] = cols
        self.time_combo["values"] = cols

        # Try defaults if those columns exist
        if "lat" in cols:
            self.lat_col_var.set("lat")
        if "lon" in cols:
            self.lon_col_var.set("lon")
        if "timestamp" in cols:
            self.time_col_var.set("timestamp")

    def plot(self):
        if self.df is None:
            messagebox.showwarning("No data", "No data loaded.")
            return

        lat_col = self.lat_col_var.get()
        lon_col = self.lon_col_var.get()

        if lat_col not in self.df.columns or lon_col not in self.df.columns:
            messagebox.showwarning("Invalid selection", "Please choose valid lat/lon columns.")
            return

        lat = self.df[lat_col]
        lon = self.df[lon_col]

        self.ax.clear()
        self.scatter = self.ax.scatter(lon, lat, s=10, label="Path")
        self.ax.set_xlabel("Longitude")
        self.ax.set_ylabel("Latitude")
        self.ax.grid(True)
        self.ax.legend()

        # Remove previous current point
        self.current_point = None

        self.canvas.draw()

    def on_timestamp_selected(self, ts_value):
        """
        Called by the app when a timestamp is selected somewhere else.
        We find the closest point in time and highlight it on the map.
        """
        if self.df is None:
            return

        time_col = self.time_col_var.get()
        lat_col = self.lat_col_var.get()
        lon_col = self.lon_col_var.get()

        for col in [time_col, lat_col, lon_col]:
            if col not in self.df.columns:
                return

        t = self.df[time_col].to_numpy()
        idx = (np.abs(t - ts_value)).argmin()

        lat = self.df.iloc[idx][lat_col]
        lon = self.df.iloc[idx][lon_col]

        # Draw or move current point marker
        if self.current_point is None:
            self.current_point = self.ax.scatter([lon], [lat], s=40, color="red", label="Selected")
            self.ax.legend()
        else:
            self.current_point.set_offsets([[lon, lat]])

        self.canvas.draw_idle()


class MainApp(tk.Tk):
    """
    Main application window:
    - Manages data model
    - Hosts multiple visualizers (XY plot, map, ...)
    - Dispatches timestamp synchronization events.
    """
    def __init__(self):
        super().__init__()
        self.title("Telemetry Viewer")

        self.data_model = DataModel()
        self.viewers = []

        self._build_ui()

    def _build_ui(self):
        # Top bar: open file
        top_frame = tk.Frame(self)
        top_frame.pack(side=tk.TOP, fill=tk.X)

        open_btn = tk.Button(top_frame, text="Open file...", command=self.on_open_file)
        open_btn.pack(side=tk.LEFT, padx=5, pady=5)

        self.file_label_var = tk.StringVar(value="No file loaded")
        tk.Label(top_frame, textvariable=self.file_label_var, anchor="w").pack(side=tk.LEFT, fill=tk.X, expand=True)

        # Notebook for visualizers
        notebook = ttk.Notebook(self)
        notebook.pack(fill=tk.BOTH, expand=True)

        # XY Plot tab
        self.xy_view = XYPlotVisualizer(notebook, app=self)
        notebook.add(self.xy_view, text="XY Plot")
        self.viewers.append(self.xy_view)

        # Map tab
        self.map_view = MapVisualizer(notebook, app=self)
        notebook.add(self.map_view, text="Map (lat/lon)")
        self.viewers.append(self.map_view)

    def on_open_file(self):
        path = filedialog.askopenfilename(
            title="Select data file",
            filetypes=[("Text/CSV files", "*.txt *.csv"), ("All files", "*.*")]
        )

        if not path:
            return

        try:
            self.data_model.load_file(path)
        except Exception as e:
            messagebox.showerror("Error", f"Failed to load file:\n{e}")
            return

        self.file_label_var.set(path)

        df = self.data_model.get_df()

        # Notify all viewers that data is ready
        for v in self.viewers:
            v.set_data(df)

    def notify_timestamp_selected(self, ts_value):
        """
        Called by viewers when they select a timestamp.
        We forward the event to all viewers (including the sender; they can ignore or use it).
        """
        for v in self.viewers:
            v.on_timestamp_selected(ts_value)


if __name__ == "__main__":
    # On Ubuntu, if tkinter is missing:
    #   sudo apt install python3-tk
    app = MainApp()
    app.mainloop()
