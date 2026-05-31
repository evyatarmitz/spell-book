! Fortran 90 example — Code Scavenge test file

module math_utils
    implicit none
    private
    public :: clamp, lerp, normalize

contains

    pure function clamp(value, lo, hi) result(res)
        real, intent(in) :: value, lo, hi
        real             :: res
        res = max(lo, min(hi, value))
    end function clamp

    pure function lerp(a, b, t) result(res)
        real, intent(in) :: a, b, t
        real             :: res
        res = a + (b - a) * t
    end function lerp

    pure function normalize(x) result(res)
        real, intent(in) :: x(:)
        real             :: res(size(x))
        real             :: norm
        norm = sqrt(sum(x**2))
        if (norm > 0.0) then
            res = x / norm
        else
            res = x
        end if
    end function normalize

end module math_utils

! ── Type definitions ──────────────────────────────────────────

module geometry
    implicit none

    type :: Vec2
        real :: x = 0.0
        real :: y = 0.0
    contains
        procedure :: length  => vec2_length
        procedure :: add     => vec2_add
        procedure :: dot_product => vec2_dot
    end type Vec2

    type :: Circle
        type(Vec2) :: center
        real       :: radius = 1.0
    contains
        procedure :: area      => circle_area
        procedure :: perimeter => circle_perimeter
    end type Circle

contains

    pure function vec2_length(self) result(len)
        class(Vec2), intent(in) :: self
        real :: len
        len = sqrt(self%x**2 + self%y**2)
    end function vec2_length

    pure function vec2_add(self, other) result(res)
        class(Vec2), intent(in) :: self, other
        type(Vec2) :: res
        res%x = self%x + other%x
        res%y = self%y + other%y
    end function vec2_add

    pure function vec2_dot(self, other) result(d)
        class(Vec2), intent(in) :: self, other
        real :: d
        d = self%x * other%x + self%y * other%y
    end function vec2_dot

    pure function circle_area(self) result(a)
        class(Circle), intent(in) :: self
        real, parameter :: PI = 3.14159265359
        real :: a
        a = PI * self%radius**2
    end function circle_area

    pure function circle_perimeter(self) result(p)
        class(Circle), intent(in) :: self
        real, parameter :: PI = 3.14159265359
        real :: p
        p = 2.0 * PI * self%radius
    end function circle_perimeter

end module geometry

! ── Main program uses subroutine ──────────────────────────────

subroutine print_vec2(v, label)
    use geometry
    type(Vec2),   intent(in) :: v
    character(*), intent(in) :: label
    write(*,'(A,": (",F6.3,", ",F6.3,")")') label, v%x, v%y
end subroutine print_vec2
