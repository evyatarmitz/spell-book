-- VHDL example — Code Scavenge test file
library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

-- ── Entity: full adder ────────────────────────────────────────

entity full_adder is
    port (
        a, b, cin : in  std_logic;
        sum, cout : out std_logic
    );
end entity full_adder;

architecture rtl_of_full_adder is
begin
    sum  <= a xor b xor cin;
    cout <= (a and b) or (cin and (a xor b));
end architecture rtl_of_full_adder;

-- ── Entity: 4-bit counter ─────────────────────────────────────

entity counter4 is
    port (
        clk   : in  std_logic;
        reset : in  std_logic;
        count : out std_logic_vector(3 downto 0)
    );
end entity counter4;

architecture behavioral_of_counter4 is
    signal count_reg : unsigned(3 downto 0) := (others => '0');
begin
    count_proc : process(clk, reset)
    begin
        if reset = '1' then
            count_reg <= (others => '0');
        elsif rising_edge(clk) then
            count_reg <= count_reg + 1;
        end if;
    end process count_proc;

    count <= std_logic_vector(count_reg);
end architecture behavioral_of_counter4;

-- ── Package with functions ────────────────────────────────────

package math_pkg is
    function clamp(val, lo, hi : integer) return integer;
    function log2_ceil(n : integer) return integer;
end package math_pkg;

package body math_pkg is
    function clamp(val, lo, hi : integer) return integer is
    begin
        if val < lo then return lo;
        elsif val > hi then return hi;
        else return val;
        end if;
    end function clamp;

    function log2_ceil(n : integer) return integer is
        variable result : integer := 0;
        variable v      : integer := n - 1;
    begin
        while v > 0 loop
            result := result + 1;
            v := v / 2;
        end loop;
        return result;
    end function log2_ceil;
end package body math_pkg;
