import tkinter as tk
from tkinter import ttk, filedialog, messagebox

import pandas as pd
import numpy as np
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.figure import Figure

import os
import webbrowser
import tempfile
import folium


import contextily as ctx
from pyproj import Transformer



# ----------------------------- Data tools ----------------------------- #

class MovingAverageTool:
    """
    Simple moving average tool.
    Takes an input column, computes a rolling mean, stores it in an output column.
    """
    def __init__(self, input_column: str, output_column: str, window_size: int):
        self.input_column = input_column
        self.output_column = output_column
        self.window_size = window_size

    def apply(self, df: pd.DataFrame) -> pd.DataFrame:
        if self.input_column not in df.columns:
            raise ValueError(f"Column '{self.input_column}' not found in DataFrame.")
        if self.window_size <= 0:
            raise ValueError("window_size must be > 0")

        result = df.copy()
        result[self.output_column] = (
            result[self.input_column]
            .rolling(window=self.window_size, center=False)
            .mean()
        )
        return result


class VoltageToTravelTool:
    """
    Convert a voltage column (e.g. suspension sensor) to travel in mm.
    Assumes a linear sensor:
        travel_mm = (v_max - V) / (v_max - v_min) * sensor_travel_mm
    So that:
        V = v_min  -> travel ≈ sensor_travel_mm
        V = v_max  -> travel ≈ 0
    """
    def __init__(self,
                 input_column: str,
                 output_column: str,
                 sensor_travel_mm: float,
                 v_min: float = 0.0,
                 v_max: float = 5.0):
        self.input_column = input_column
        self.output_column = output_column
        self.sensor_travel_mm = sensor_travel_mm
        self.v_min = v_min
        self.v_max = v_max

    def apply(self, df: pd.DataFrame) -> pd.DataFrame:
        if self.input_column not in df.columns:
            raise ValueError(f"Column '{self.input_column}' not found in DataFrame.")
        if self.v_max == self.v_min:
            raise ValueError("v_max and v_min cannot be equal.")
        if self.sensor_travel_mm <= 0:
            raise ValueError("sensor_travel_mm must be > 0")

        result = df.copy()
        v = result[self.input_column]

        # Inverted mapping: high voltage -> small travel, low voltage -> large travel
        norm = (self.v_max - v) / (self.v_max - self.v_min)
        travel_mm = norm * self.sensor_travel_mm

        result[self.output_column] = travel_mm
        return result

# ----------------------------- Data model ----------------------------- #

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

    def apply_moving_average(self, input_column: str, output_column: str, window_size: int):
        """
        Apply a moving average tool to the processed_df.
        """
        if self.processed_df is None:
            raise RuntimeError("No data loaded.")
        tool = MovingAverageTool(input_column, output_column, window_size)
        self.processed_df = tool.apply(self.processed_df)

    def apply_voltage_to_travel(self,
                                input_column: str,
                                output_column: str,
                                sensor_travel_mm: float,
                                v_min: float,
                                v_max: float):
        """
        Apply voltage-to-travel tool to the processed_df.
        """
        if self.processed_df is None:
            raise RuntimeError("No data loaded.")
        tool = VoltageToTravelTool(
            input_column=input_column,
            output_column=output_column,
            sensor_travel_mm=sensor_travel_mm,
            v_min=v_min,
            v_max=v_max,
        )
        self.processed_df = tool.apply(self.processed_df)


# ----------------------------- XY Visualizer ----------------------------- #

class XYPlotVisualizer(tk.Frame):
    """
    XY plot viewer using matplotlib.
    - X axis: single column
    - Y axis: multiple columns (multi-select listbox)
    - Processing tools:
        - Moving average
        - Voltage -> travel (mm)
    - Emits timestamp selection when user clicks on the plot.
    """
    def __init__(self, master, app, **kwargs):
        super().__init__(master, **kwargs)
        self.app = app
        self.df = None

        self.x_var = tk.StringVar()

        # Moving average tool UI variables
        self.ma_input_var = tk.StringVar()
        self.ma_output_var = tk.StringVar(value="ma_output")
        self.ma_window_var = tk.StringVar(value="10")

        # Voltage -> travel tool UI variables
        self.v_input_var = tk.StringVar()
        self.v_output_var = tk.StringVar(value="travel_mm")
        self.v_travel_var = tk.StringVar(value="160")   # sensor travel in mm
        self.v_min_var = tk.StringVar(value="0.0")
        self.v_max_var = tk.StringVar(value="5.0")

        self._build_ui()

        # Matplotlib figure
        self.fig = Figure(figsize=(5, 4))
        self.ax = self.fig.add_subplot(111)
        self.canvas = FigureCanvasTkAgg(self.fig, master=self.plot_frame)
        self.canvas_widget = self.canvas.get_tk_widget()
        self.canvas_widget.pack(fill=tk.BOTH, expand=True)

        self.cursor_line = None

        # Connect matplotlib click event
        self.canvas.mpl_connect("button_press_event", self._on_click)

    def _build_ui(self):
        # Top frame: X/Y selection and plot button
        selection_frame = tk.Frame(self)
        selection_frame.pack(side=tk.TOP, fill=tk.X, padx=5, pady=5)

        # X selection
        x_frame = tk.Frame(selection_frame)
        x_frame.pack(side=tk.LEFT, fill=tk.Y, padx=5)

        tk.Label(x_frame, text="X:").pack(anchor="w")
        self.x_combo = ttk.Combobox(x_frame, textvariable=self.x_var, state="readonly", width=15)
        self.x_combo.pack(anchor="w")

        # Y selection (multi)
        y_frame = tk.Frame(selection_frame)
        y_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=5)

        tk.Label(y_frame, text="Y (multiple):").pack(anchor="w")
        self.y_listbox = tk.Listbox(
            y_frame,
            selectmode=tk.MULTIPLE,
            height=5,
            exportselection=False
        )
        self.y_listbox.pack(fill=tk.BOTH, expand=True)

        # Plot button
        btn_frame = tk.Frame(selection_frame)
        btn_frame.pack(side=tk.LEFT, fill=tk.Y, padx=5)

        plot_btn = tk.Button(btn_frame, text="Plot", command=self.plot)
        plot_btn.pack(pady=5)

        # Tool frame: processing tools
        tool_frame = tk.LabelFrame(self, text="Processing tools")
        tool_frame.pack(side=tk.TOP, fill=tk.X, padx=5, pady=5)

        # ---- Moving average UI ----
        tk.Label(tool_frame, text="Moving average:").grid(row=0, column=0, sticky="w", padx=2, pady=2)

        tk.Label(tool_frame, text="Input column:").grid(row=1, column=0, sticky="w", padx=2, pady=2)
        self.ma_input_combo = ttk.Combobox(tool_frame, textvariable=self.ma_input_var, state="readonly", width=15)
        self.ma_input_combo.grid(row=1, column=1, sticky="w", padx=2, pady=2)

        tk.Label(tool_frame, text="Output column:").grid(row=1, column=2, sticky="w", padx=2, pady=2)
        self.ma_output_entry = tk.Entry(tool_frame, textvariable=self.ma_output_var, width=15)
        self.ma_output_entry.grid(row=1, column=3, sticky="w", padx=2, pady=2)

        tk.Label(tool_frame, text="Window:").grid(row=1, column=4, sticky="w", padx=2, pady=2)
        self.ma_window_entry = tk.Entry(tool_frame, textvariable=self.ma_window_var, width=5)
        self.ma_window_entry.grid(row=1, column=5, sticky="w", padx=2, pady=2)

        ma_btn = tk.Button(tool_frame, text="Apply MA", command=self._on_apply_moving_average)
        ma_btn.grid(row=1, column=6, sticky="w", padx=5, pady=2)

        # ---- Voltage -> travel UI ----
        row_v = 2
        tk.Label(tool_frame, text="Voltage -> travel (mm):").grid(row=row_v, column=0, sticky="w", padx=2, pady=6)

        tk.Label(tool_frame, text="Input (V):").grid(row=row_v + 1, column=0, sticky="w", padx=2, pady=2)
        self.v_input_combo = ttk.Combobox(tool_frame, textvariable=self.v_input_var, state="readonly", width=15)
        self.v_input_combo.grid(row=row_v + 1, column=1, sticky="w", padx=2, pady=2)

        tk.Label(tool_frame, text="Output (mm):").grid(row=row_v + 1, column=2, sticky="w", padx=2, pady=2)
        self.v_output_entry = tk.Entry(tool_frame, textvariable=self.v_output_var, width=15)
        self.v_output_entry.grid(row=row_v + 1, column=3, sticky="w", padx=2, pady=2)

        tk.Label(tool_frame, text="Travel mm:").grid(row=row_v + 1, column=4, sticky="w", padx=2, pady=2)
        self.v_travel_entry = tk.Entry(tool_frame, textvariable=self.v_travel_var, width=7)
        self.v_travel_entry.grid(row=row_v + 1, column=5, sticky="w", padx=2, pady=2)

        tk.Label(tool_frame, text="Vmin:").grid(row=row_v + 2, column=0, sticky="w", padx=2, pady=2)
        self.v_min_entry = tk.Entry(tool_frame, textvariable=self.v_min_var, width=7)
        self.v_min_entry.grid(row=row_v + 2, column=1, sticky="w", padx=2, pady=2)

        tk.Label(tool_frame, text="Vmax:").grid(row=row_v + 2, column=2, sticky="w", padx=2, pady=2)
        self.v_max_entry = tk.Entry(tool_frame, textvariable=self.v_max_var, width=7)
        self.v_max_entry.grid(row=row_v + 2, column=3, sticky="w", padx=2, pady=2)

        v_btn = tk.Button(tool_frame, text="Apply V->mm", command=self._on_apply_voltage_to_travel)
        v_btn.grid(row=row_v + 2, column=6, sticky="w", padx=5, pady=2)

        # Plot frame
        self.plot_frame = tk.Frame(self)
        self.plot_frame.pack(side=tk.TOP, fill=tk.BOTH, expand=True)

    # ---------------- Data hookup ---------------- #

    def set_data(self, df: pd.DataFrame):
        """
        Receive the DataFrame from the app and update available columns.
        """
        self.df = df
        cols = list(df.columns)

        # X combo
        self.x_combo["values"] = cols
        if "timestamp" in cols:
            self.x_var.set("timestamp")
        elif cols:
            self.x_var.set(cols[0])

        # Y listbox
        self.y_listbox.delete(0, tk.END)
        for c in cols:
            self.y_listbox.insert(tk.END, c)

        # Moving average input combo
        self.ma_input_combo["values"] = cols
        if "ax" in cols:
            self.ma_input_var.set("ax")
        elif cols:
            self.ma_input_var.set(cols[0])

        # Voltage input combo
        self.v_input_combo["values"] = cols
        # Try to guess a voltage column
        guessed_v_col = None
        for name in cols:
            if "travel" in name and ("v" in name or "volt" in name):
                guessed_v_col = name
                break
        if guessed_v_col is not None:
            self.v_input_var.set(guessed_v_col)
        elif cols:
            self.v_input_var.set(cols[0])

        # After data change, clear plot cursor
        self.cursor_line = None
        self.ax.clear()
        self.canvas.draw_idle()

    # ---------------- Plotting ---------------- #

    def plot(self):
        """
        Plot all selected Y columns against the selected X column.
        """
        if self.df is None:
            messagebox.showwarning("No data", "No data loaded.")
            return

        x_col = self.x_var.get()
        if x_col not in self.df.columns:
            messagebox.showwarning("Invalid X", "Please choose a valid X column.")
            return

        # Get selected Y columns
        y_indices = self.y_listbox.curselection()
        if not y_indices:
            messagebox.showwarning("No Y selected", "Please select at least one Y column.")
            return

        y_cols = [self.y_listbox.get(i) for i in y_indices]

        x = self.df[x_col]

        self.ax.clear()
        for y_col in y_cols:
            if y_col not in self.df.columns:
                continue
            y = self.df[y_col]
            self.ax.plot(x, y, label=f"{y_col}")

        self.ax.set_xlabel(x_col)
        self.ax.set_ylabel("Value")
        self.ax.grid(True)
        self.ax.legend()

        # Reset cursor line
        self.cursor_line = None

        self.canvas.draw_idle()

    # ---------------- Moving average tool ---------------- #

    def _on_apply_moving_average(self):
        """
        Read moving average parameters from UI, ask app to apply it, then refresh.
        """
        if self.df is None:
            messagebox.showwarning("No data", "No data loaded.")
            return

        input_col = self.ma_input_var.get().strip()
        output_col = self.ma_output_var.get().strip()
        window_str = self.ma_window_var.get().strip()

        if not input_col or input_col not in self.df.columns:
            messagebox.showwarning("Invalid column", "Please choose a valid input column.")
            return
        if not output_col:
            messagebox.showwarning("Invalid output name", "Please set an output column name.")
            return
        try:
            window = int(window_str)
        except ValueError:
            messagebox.showwarning("Invalid window", "Window must be an integer.")
            return

        try:
            self.app.apply_moving_average(input_col, output_col, window)
        except Exception as e:
            messagebox.showerror("Error applying moving average", str(e))
            return

    # ---------------- Voltage -> travel tool ---------------- #

    def _on_apply_voltage_to_travel(self):
        """
        Read voltage->travel parameters from UI, ask app to apply it, then refresh.
        """
        if self.df is None:
            messagebox.showwarning("No data", "No data loaded.")
            return

        input_col = self.v_input_var.get().strip()
        output_col = self.v_output_var.get().strip()
        travel_str = self.v_travel_var.get().strip()
        vmin_str = self.v_min_var.get().strip()
        vmax_str = self.v_max_var.get().strip()

        if not input_col or input_col not in self.df.columns:
            messagebox.showwarning("Invalid input", "Please choose a valid voltage column.")
            return
        if not output_col:
            messagebox.showwarning("Invalid output name", "Please set an output column name.")
            return

        try:
            travel_mm = float(travel_str)
            v_min = float(vmin_str)
            v_max = float(vmax_str)
        except ValueError:
            messagebox.showwarning("Invalid parameters", "Travel and Vmin/Vmax must be numeric.")
            return

        try:
            self.app.apply_voltage_to_travel(input_col, output_col, travel_mm, v_min, v_max)
        except Exception as e:
            messagebox.showerror("Error applying V->mm", str(e))
            return

    # ---------------- Sync via timestamp ---------------- #

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

        x_col = self.x_var.get()
        if x_col not in self.df.columns:
            return

        t = self.df[x_col].to_numpy()
        selected_x = event.xdata
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
        ymin, ymax = self.ax.get_ylim()
        if ymin == ymax:
            ymin, ymax = 0, 1

        if self.cursor_line is None:
            self.cursor_line = self.ax.axvline(ts_value, color="red", linestyle="--")
        else:
            self.cursor_line.set_xdata([ts_value, ts_value])
            self.cursor_line.set_ydata([ymin, ymax])

        self.canvas.draw_idle()

    def on_timestamp_selected(self, ts_value):
        """
        Called by the app when another viewer selects a timestamp.
        We move the cursor line accordingly (if X axis is time-like).
        """
        if self.df is None:
            return
        x_col = self.x_var.get()
        if x_col not in self.df.columns:
            return

        self._update_cursor_line(ts_value)


# ----------------------------- Map Visualizer ----------------------------- #

class MapVisualizer(tk.Frame):
    """
    2D map-like viewer for latitude/longitude with satellite background.
    Uses WebMercator tiles (Esri World Imagery) via contextily and overlays the path.
    Synchronizes with timestamp: highlights the point corresponding to the selected timestamp.
    """
    def __init__(self, master, app, **kwargs):
        super().__init__(master, **kwargs)
        self.app = app
        self.df = None

        self.lat_col_var = tk.StringVar(value="lat")
        self.lon_col_var = tk.StringVar(value="lon")
        self.time_col_var = tk.StringVar(value="timestamp")

        # Transformer from WGS84 (lat/lon) to WebMercator (meters)
        # always_xy=True means input order is (lon, lat)
        self.zoom_var = tk.IntVar(value=17) 
        self.half_size_m = 1000.0
        
        self._transformer = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)

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
        control_frame.pack(side=tk.TOP, fill=tk.X, padx=5, pady=5)

        tk.Label(control_frame, text="Lat:").pack(side=tk.LEFT)
        self.lat_combo = ttk.Combobox(control_frame, textvariable=self.lat_col_var, state="readonly", width=10)
        self.lat_combo.pack(side=tk.LEFT, padx=5)

        tk.Label(control_frame, text="Lon:").pack(side=tk.LEFT)
        self.lon_combo = ttk.Combobox(control_frame, textvariable=self.lon_col_var, state="readonly", width=10)
        self.lon_combo.pack(side=tk.LEFT, padx=5)

        tk.Label(control_frame, text="Time:").pack(side=tk.LEFT)
        self.time_combo = ttk.Combobox(control_frame, textvariable=self.time_col_var, state="readonly", width=10)
        self.time_combo.pack(side=tk.LEFT, padx=5)

        plot_btn = tk.Button(control_frame, text="Plot map", command=self.plot)
        plot_btn.pack(side=tk.LEFT, padx=5)
        
        zoom_out_btn = tk.Button(control_frame, text="Zoom -", command=self.zoom_out)
        zoom_out_btn.pack(side=tk.LEFT, padx=2)

        zoom_in_btn = tk.Button(control_frame, text="Zoom +", command=self.zoom_in)
        zoom_in_btn.pack(side=tk.LEFT, padx=2)

        self.plot_frame = tk.Frame(self)
        self.plot_frame.pack(side=tk.TOP, fill=tk.BOTH, expand=True)
        
    def zoom_in(self):
        """
        Zoom in: reduce the map window size (half_size_m).
        """
        # Do not go below 50 m radius
        self.half_size_m = max(50.0, self.half_size_m / 2.0)
        self.plot()

    def zoom_out(self):
        """
        Zoom out: increase the map window size (half_size_m).
        """
        # Do not go above 20 km radius
        self.half_size_m = min(20000.0, self.half_size_m * 2.0)
        self.plot()


    def set_data(self, df: pd.DataFrame):
        """
        Receive DataFrame from app and update column lists.
        """
        self.df = df

        cols = list(df.columns)
        self.lat_combo["values"] = cols
        self.lon_combo["values"] = cols
        self.time_combo["values"] = cols

        if "lat" in cols:
            self.lat_col_var.set("lat")
        elif cols:
            self.lat_col_var.set(cols[0])

        if "lon" in cols:
            self.lon_col_var.set("lon")
        elif cols:
            self.lon_col_var.set(cols[0])

        if "timestamp" in cols:
            self.time_col_var.set("timestamp")
        elif cols:
            self.time_col_var.set(cols[0])

        self.ax.clear()
        self.canvas.draw_idle()

    def plot(self):
        """
        Plot the path on top of map tiles using contextily.add_basemap.
        We force at least a 1 km x 1 km area around the track center,
        so very small movements are still visible with some context.
        """
        if self.df is None:
            messagebox.showwarning("No data", "No data loaded.")
            return

        lat_col = self.lat_col_var.get()
        lon_col = self.lon_col_var.get()

        if lat_col not in self.df.columns or lon_col not in self.df.columns:
            messagebox.showwarning("Invalid selection", "Please choose valid lat/lon columns.")
            return

        # Drop NaNs
        sub_df = self.df[[lat_col, lon_col]].dropna()
        if sub_df.empty:
            messagebox.showwarning("No valid data", "No valid lat/lon points to plot on the map.")
            return

        lats = sub_df[lat_col].to_numpy()
        lons = sub_df[lon_col].to_numpy()

        # Transform to WebMercator (x, y in meters)
        xs, ys = self._transformer.transform(lons, lats)

        # Center of the track in WebMercator
        cx = xs.mean()
        cy = ys.mean()

        # Force a minimum half-size of 1000 m (1 km) around the center
        half_size = self.half_size_m

        xmin_p = cx - half_size
        xmax_p = cx + half_size
        ymin_p = cy - half_size
        ymax_p = cy + half_size


        self.ax.clear()

        # First set axis limits in EPSG:3857
        self.ax.set_xlim(xmin_p, xmax_p)
        self.ax.set_ylim(ymin_p, ymax_p)

        # Scatter the path on top (in WebMercator)
        self.scatter = self.ax.scatter(xs, ys, s=20, c="red", label="Path", zorder=3)

        try:
            # Reasonable zoom for a 2 km x 2 km area
            # zoom = 16  # try 15 or 17 if you want
            
            zoom = self.zoom_var.get()
            if zoom < 0:
                zoom = 0
            elif zoom > 19:
                zoom = 19
            self.zoom_var.set(zoom)

            ctx.add_basemap(
                self.ax,
                source=ctx.providers.Esri.WorldImagery,
                zoom=17,           # puoi provare anche 16 o 18
                crs="EPSG:3857",
            )
        except Exception as e:
            import traceback
            print("Error loading basemap with add_basemap:")
            traceback.print_exc()
            self.ax.text(
                0.5, 0.5,
                f"Map data not available\n{e}",
                transform=self.ax.transAxes,
                ha="center", va="center", fontsize=10, color="red"
            )

        self.ax.set_xticks([])
        self.ax.set_yticks([])
        self.ax.set_title("Map (OpenStreetMap)")
        self.ax.set_aspect("equal", "box")

        self.current_point = None

        self.canvas.draw_idle()

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

        lat = float(self.df.iloc[idx][lat_col])
        lon = float(self.df.iloc[idx][lon_col])

        # Transform this single point to WebMercator
        x, y = self._transformer.transform(lon, lat)

        # Draw or move the selected point marker
        if self.current_point is None:
            self.current_point = self.ax.scatter([x], [y], s=50, color="yellow", label="Selected", zorder=3)
            self.ax.legend()
        else:
            self.current_point.set_offsets([[x, y]])

        self.canvas.draw_idle()




# ----------------------------- Main app ----------------------------- #

class MainApp(tk.Tk):
    """
    Main application window:
    - Manages data model
    - Hosts multiple visualizers (XY plot, map, ...)
    - Dispatches timestamp synchronization events.
    - Applies data tools and refreshes viewers.
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

    # ---------------- File handling ---------------- #

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
        for v in self.viewers:
            v.set_data(df)

    # ---------------- Tools API ---------------- #

    def apply_moving_average(self, input_column: str, output_column: str, window_size: int):
        """
        Called by XYPlotVisualizer when the user applies a moving average.
        We update the DataModel, then refresh all viewers.
        """
        self.data_model.apply_moving_average(input_column, output_column, window_size)
        df = self.data_model.get_df()
        for v in self.viewers:
            v.set_data(df)

    def apply_voltage_to_travel(self,
                                input_column: str,
                                output_column: str,
                                sensor_travel_mm: float,
                                v_min: float,
                                v_max: float):
        """
        Called by XYPlotVisualizer when the user applies voltage->travel conversion.
        """
        self.data_model.apply_voltage_to_travel(input_column, output_column, sensor_travel_mm, v_min, v_max)
        df = self.data_model.get_df()
        for v in self.viewers:
            v.set_data(df)

    # ---------------- Timestamp sync ---------------- #

    def notify_timestamp_selected(self, ts_value):
        """
        Called by viewers when they select a timestamp.
        We forward the event to all viewers (including the sender).
        """
        for v in self.viewers:
            v.on_timestamp_selected(ts_value)


if __name__ == "__main__":
    # On Ubuntu, if tkinter is missing:
    #   sudo apt install python3-tk
    app = MainApp()
    app.mainloop()
