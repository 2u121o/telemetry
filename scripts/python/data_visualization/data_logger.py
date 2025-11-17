import tkinter as tk
from tkinter import filedialog, messagebox
import pandas as pd
import matplotlib.pyplot as plt


class TxtDataLoader:
    """
    Class to load txt/csv-like files and expose their columns.
    """
    def __init__(self, delimiter=None):
        """
        :param delimiter: Optional delimiter. If None, pandas will try to infer it.
        """
        self.delimiter = delimiter
        self.dataframe = None
        self.file_path = None

    def load_file_dialog(self, parent=None):
        """Open a file dialog, let the user choose a file, and load it into a DataFrame."""
        file_path = filedialog.askopenfilename(
            title="Select data file",
            filetypes=[
                ("Text and CSV files", "*.txt *.csv"),
                ("All files", "*.*"),
            ],
            parent=parent,
        )

        if not file_path:
            return None  # User canceled

        self.file_path = file_path
        self._load_file(file_path)
        return file_path

    def _load_file(self, file_path: str):
        """Load the file into a pandas DataFrame and normalize column names."""
        if self.delimiter is None:
            # Let pandas try to infer the separator
            df = pd.read_csv(file_path, sep=None, engine="python")
        else:
            df = pd.read_csv(file_path, sep=self.delimiter)

        # Strip whitespace from column names to avoid issues like "  ax"
        df.columns = df.columns.str.strip()

        self.dataframe = df

    def get_columns(self):
        """Return the list of column names of the loaded DataFrame."""
        if self.dataframe is None:
            raise RuntimeError("No file loaded. Call load_file_dialog() first.")
        return list(self.dataframe.columns)

    def get_dataframe(self):
        """Return the underlying DataFrame."""
        if self.dataframe is None:
            raise RuntimeError("No file loaded. Call load_file_dialog() first.")
        return self.dataframe


class DataPlotter:
    """
    Class responsible for plotting data from a DataFrame.
    """
    def __init__(self, dataframe: pd.DataFrame):
        self.df = dataframe

    def plot_columns(self, x_column: str, y_columns):
        """
        Plot one or more Y columns against a single X column.

        :param x_column: Name of the column to use for the X axis.
        :param y_columns: Name or list of names of columns to use for the Y axis.
        """
        if isinstance(y_columns, str):
            y_columns = [y_columns]

        for col in [x_column] + y_columns:
            if col not in self.df.columns:
                raise ValueError(f"Column '{col}' not found in DataFrame.")

        x = self.df[x_column]

        plt.figure()
        for y_col in y_columns:
            y = self.df[y_col]
            plt.plot(x, y, label=y_col)

        plt.xlabel(x_column)
        plt.ylabel("Value")
        plt.title(f"{', '.join(y_columns)} vs {x_column}")
        plt.legend()
        plt.grid(True)
        plt.tight_layout()
        plt.show()


class PlotInterfaceGUI:
    """
    Tkinter-based GUI to:
    - choose a file
    - select X and Y columns
    - plot selected data
    """
    def __init__(self, root, delimiter=None):
        self.root = root
        self.root.title("Data Logger Viewer")

        self.loader = TxtDataLoader(delimiter=delimiter)
        self.plotter = None

        # Widgets
        self.file_label_var = tk.StringVar(value="No file loaded")
        self._build_widgets()

    def _build_widgets(self):
        """Create and place all widgets on the main window."""
        # Top frame: file selection
        top_frame = tk.Frame(self.root)
        top_frame.pack(fill=tk.X, padx=10, pady=10)

        btn_load = tk.Button(top_frame, text="Open file...", command=self.on_open_file)
        btn_load.pack(side=tk.LEFT)

        lbl_file = tk.Label(top_frame, textvariable=self.file_label_var, anchor="w")
        lbl_file.pack(side=tk.LEFT, padx=10, expand=True, fill=tk.X)

        # Middle frame: column selection
        mid_frame = tk.Frame(self.root)
        mid_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        # X axis listbox (single selection)
        x_frame = tk.Frame(mid_frame)
        x_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        lbl_x = tk.Label(x_frame, text="X axis column (single)")
        lbl_x.pack(anchor="w")

        self.x_listbox = tk.Listbox(x_frame, exportselection=False)
        self.x_listbox.pack(fill=tk.BOTH, expand=True)

        # Y axis listbox (multiple selection)
        y_frame = tk.Frame(mid_frame)
        y_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(10, 0))

        lbl_y = tk.Label(y_frame, text="Y axis columns (multiple)")
        lbl_y.pack(anchor="w")

        self.y_listbox = tk.Listbox(y_frame, selectmode=tk.MULTIPLE, exportselection=False)
        self.y_listbox.pack(fill=tk.BOTH, expand=True)

        # Bottom frame: plot button
        bottom_frame = tk.Frame(self.root)
        bottom_frame.pack(fill=tk.X, padx=10, pady=10)

        btn_plot = tk.Button(bottom_frame, text="Plot", command=self.on_plot)
        btn_plot.pack(side=tk.RIGHT)

    def on_open_file(self):
        """Handle file open button click."""
        try:
            file_path = self.loader.load_file_dialog(parent=self.root)
        except Exception as e:
            messagebox.showerror("Error", f"Failed to load file:\n{e}")
            return

        if not file_path:
            return  # User canceled

        self.file_label_var.set(file_path)

        try:
            columns = self.loader.get_columns()
        except Exception as e:
            messagebox.showerror("Error", f"Failed to read columns:\n{e}")
            return

        # Clear and repopulate listboxes
        self.x_listbox.delete(0, tk.END)
        self.y_listbox.delete(0, tk.END)

        for col in columns:
            self.x_listbox.insert(tk.END, col)
            self.y_listbox.insert(tk.END, col)

        # Create a new plotter with the new DataFrame
        self.plotter = DataPlotter(self.loader.get_dataframe())

    def on_plot(self):
        """Handle plot button click."""
        if self.plotter is None:
            messagebox.showwarning("No data", "Please load a file first.")
            return

        # Get X selection (single)
        x_selection = self.x_listbox.curselection()
        if len(x_selection) != 1:
            messagebox.showwarning("Selection error", "Please select exactly one X axis column.")
            return

        x_column = self.x_listbox.get(x_selection[0])

        # Get Y selection (one or more)
        y_selection = self.y_listbox.curselection()
        if len(y_selection) == 0:
            messagebox.showwarning("Selection error", "Please select at least one Y axis column.")
            return

        y_columns = [self.y_listbox.get(i) for i in y_selection]

        try:
            self.plotter.plot_columns(x_column, y_columns)
        except Exception as e:
            messagebox.showerror("Plot error", str(e))


if __name__ == "__main__":
    # Note: if Tkinter is missing, install it on Ubuntu with:
    #   sudo apt install python3-tk
    root = tk.Tk()
    app = PlotInterfaceGUI(root)
    root.mainloop()
