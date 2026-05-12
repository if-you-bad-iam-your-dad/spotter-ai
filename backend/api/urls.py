from django.urls import path
from .views import TripCalculateView

urlpatterns = [
    path('trip/', TripCalculateView.as_view(), name='trip'),
    path('calculate-trip/', TripCalculateView.as_view(), name='calculate-trip'),
]
