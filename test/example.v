// Verilog / SystemVerilog example — Code Scavenge test file

// ── Modules ───────────────────────────────────────────────────

module full_adder (
    input  wire a, b, cin,
    output wire sum, cout
);
    assign sum  = a ^ b ^ cin;
    assign cout = (a & b) | (cin & (a ^ b));
endmodule

module counter #(parameter WIDTH = 8) (
    input  wire             clk, reset,
    output reg [WIDTH-1:0]  count
);
    always @(posedge clk or posedge reset) begin
        if (reset) count <= 0;
        else       count <= count + 1;
    end
endmodule

module alu (
    input  wire [7:0] a, b,
    input  wire [1:0] op,
    output reg  [7:0] result
);
    always @(*) begin
        case (op)
            2'b00: result = a + b;
            2'b01: result = a - b;
            2'b10: result = a & b;
            2'b11: result = a | b;
        endcase
    end
endmodule

// ── Functions & Tasks ─────────────────────────────────────────

module math_utils;
    function automatic [7:0] clamp;
        input [7:0] val, lo, hi;
        begin
            if (val < lo)      clamp = lo;
            else if (val > hi) clamp = hi;
            else               clamp = val;
        end
    endfunction

    function automatic integer log2_ceil;
        input integer n;
        integer i;
        begin
            log2_ceil = 0;
            i = n - 1;
            while (i > 0) begin
                log2_ceil = log2_ceil + 1;
                i = i >> 1;
            end
        end
    endfunction

    task print_binary;
        input [7:0] val;
        input [63:0] label_str;
        begin
            $display("%s = %08b", label_str, val);
        end
    endtask
endmodule

// ── SystemVerilog interface ────────────────────────────────────

interface axi_bus #(parameter DATA_WIDTH = 32);
    logic [DATA_WIDTH-1:0] data;
    logic                  valid;
    logic                  ready;
endinterface
